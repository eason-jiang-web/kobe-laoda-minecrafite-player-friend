import { Database } from "bun:sqlite";
import type {
  ChestRecord,
  Vec3Lit,
  Waypoint,
  WorldMemorySnapshot,
} from "@itto/shared";

/**
 * itto's MC-specific world memory: a small bun:sqlite store for spatial facts
 * the body produces and reads at high frequency — named waypoints/base coords,
 * a chest index (what's in which chest), and freeform session notes.
 *
 * This is deliberately separate from the brain's long-term memory (gbrain):
 * itto owns the spatial/MC data locally and self-contained; the brain may read
 * `itto://memory/world` over MCP and promote anything worth keeping long-term.
 * itto never calls the brain.
 */
export class WorldMemory {
  private readonly db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { create: true });
    this.db.run("PRAGMA journal_mode = WAL;");
    this.db.run("PRAGMA foreign_keys = ON;");
    this.migrate();
  }

  private migrate(): void {
    this.db.run(`CREATE TABLE IF NOT EXISTS waypoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      x REAL NOT NULL, y REAL NOT NULL, z REAL NOT NULL,
      dimension TEXT NOT NULL,
      kind TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`);
    this.db.run(`CREATE TABLE IF NOT EXISTS chests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      x REAL NOT NULL, y REAL NOT NULL, z REAL NOT NULL,
      dimension TEXT NOT NULL,
      label TEXT,
      last_indexed_at INTEGER NOT NULL,
      UNIQUE(x, y, z, dimension)
    );`);
    this.db.run(`CREATE TABLE IF NOT EXISTS chest_items (
      chest_id INTEGER NOT NULL,
      item TEXT NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (chest_id, item),
      FOREIGN KEY (chest_id) REFERENCES chests(id) ON DELETE CASCADE
    );`);
    this.db.run(`CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      at INTEGER NOT NULL,
      session TEXT NOT NULL
    );`);
  }

  // ── Waypoints ──────────────────────────────────────────────────────────

  rememberLocation(input: {
    name: string;
    pos: Vec3Lit;
    dimension: string;
    kind?: string;
    note?: string;
  }): Waypoint {
    const now = Date.now();
    this.db
      .query(
        `INSERT INTO waypoints (name,x,y,z,dimension,kind,note,created_at,updated_at)
         VALUES ($name,$x,$y,$z,$dim,$kind,$note,$now,$now)
         ON CONFLICT(name) DO UPDATE SET
           x=$x, y=$y, z=$z, dimension=$dim, kind=$kind, note=$note, updated_at=$now`,
      )
      .run({
        $name: input.name,
        $x: input.pos.x,
        $y: input.pos.y,
        $z: input.pos.z,
        $dim: input.dimension,
        $kind: input.kind ?? "poi",
        $note: input.note ?? null,
        $now: now,
      });
    return this.getWaypoint(input.name)!;
  }

  getWaypoint(name: string): Waypoint | null {
    const row = this.db.query(`SELECT * FROM waypoints WHERE name=$name`).get({ $name: name }) as
      | WaypointRow
      | null;
    return row ? rowToWaypoint(row) : null;
  }

  recallLocations(filter?: { kind?: string; near?: Vec3Lit; limit?: number }): Waypoint[] {
    const rows = (
      filter?.kind
        ? this.db.query(`SELECT * FROM waypoints WHERE kind=$kind`).all({ $kind: filter.kind })
        : this.db.query(`SELECT * FROM waypoints`).all()
    ) as WaypointRow[];
    let wps = rows.map(rowToWaypoint);
    const near = filter?.near;
    if (near) wps = wps.sort((a, b) => dist(a.pos, near) - dist(b.pos, near));
    return wps.slice(0, filter?.limit ?? 20);
  }

  forgetLocation(name: string): boolean {
    const res = this.db.query(`DELETE FROM waypoints WHERE name=$name`).run({ $name: name });
    return res.changes > 0;
  }

  // ── Chests ─────────────────────────────────────────────────────────────

  indexChest(input: {
    pos: Vec3Lit;
    dimension: string;
    label?: string;
    contents: Array<{ item: string; count: number }>;
  }): ChestRecord {
    const now = Date.now();
    this.db
      .query(
        `INSERT INTO chests (x,y,z,dimension,label,last_indexed_at)
         VALUES ($x,$y,$z,$dim,$label,$now)
         ON CONFLICT(x,y,z,dimension) DO UPDATE SET
           label=COALESCE($label,label), last_indexed_at=$now`,
      )
      .run({
        $x: input.pos.x,
        $y: input.pos.y,
        $z: input.pos.z,
        $dim: input.dimension,
        $label: input.label ?? null,
        $now: now,
      });
    const row = this.db
      .query(`SELECT * FROM chests WHERE x=$x AND y=$y AND z=$z AND dimension=$dim`)
      .get({ $x: input.pos.x, $y: input.pos.y, $z: input.pos.z, $dim: input.dimension }) as ChestRow;
    const chest = rowToChest(row);

    this.db.query(`DELETE FROM chest_items WHERE chest_id=$id`).run({ $id: chest.id });
    const ins = this.db.query(`INSERT INTO chest_items (chest_id,item,count) VALUES ($id,$item,$count)`);
    for (const c of input.contents) ins.run({ $id: chest.id, $item: c.item, $count: c.count });
    return chest;
  }

  /** Chests known to hold `item`, most-stocked first. Unblocks fetch_item. */
  findChestsWithItem(item: string, dimension?: string): Array<{ chest: ChestRecord; count: number }> {
    const sql = `SELECT c.*, ci.count AS item_count
                 FROM chest_items ci JOIN chests c ON c.id = ci.chest_id
                 WHERE ci.item = $item ${dimension ? "AND c.dimension = $dim" : ""}
                 ORDER BY ci.count DESC`;
    const params: Record<string, string> = { $item: item };
    if (dimension) params.$dim = dimension;
    const rows = this.db.query(sql).all(params) as Array<ChestRow & { item_count: number }>;
    return rows.map((r) => ({ chest: rowToChest(r), count: r.item_count }));
  }

  // ── Notes ──────────────────────────────────────────────────────────────

  addNote(text: string, session: string): void {
    this.db
      .query(`INSERT INTO notes (text,at,session) VALUES ($text,$at,$session)`)
      .run({ $text: text, $at: Date.now(), $session: session });
  }

  recentNotes(limit = 20): Array<{ id: number; text: string; at: number; session: string }> {
    return this.db
      .query(`SELECT id,text,at,session FROM notes ORDER BY at DESC LIMIT $limit`)
      .all({ $limit: limit }) as Array<{ id: number; text: string; at: number; session: string }>;
  }

  // ── Snapshot / lifecycle ───────────────────────────────────────────────

  snapshot(): WorldMemorySnapshot {
    const waypoints = this.recallLocations({ limit: 100 });
    const chestRows = this.db.query(`SELECT * FROM chests`).all() as ChestRow[];
    const itemsStmt = this.db.query(`SELECT item,count FROM chest_items WHERE chest_id=$id`);
    const chests = chestRows.map((r) => {
      const chest = rowToChest(r);
      const contents = itemsStmt.all({ $id: chest.id }) as Array<{ item: string; count: number }>;
      return { ...chest, contents };
    });
    return { waypoints, chests, notes: this.recentNotes(20) };
  }

  close(): void {
    this.db.close();
  }
}

// ── Row mappers ────────────────────────────────────────────────────────────

interface WaypointRow {
  id: number;
  name: string;
  x: number;
  y: number;
  z: number;
  dimension: string;
  kind: string;
  note: string | null;
  created_at: number;
  updated_at: number;
}

interface ChestRow {
  id: number;
  x: number;
  y: number;
  z: number;
  dimension: string;
  label: string | null;
  last_indexed_at: number;
}

function rowToWaypoint(r: WaypointRow): Waypoint {
  return {
    id: r.id,
    name: r.name,
    pos: { x: r.x, y: r.y, z: r.z },
    dimension: r.dimension,
    kind: r.kind,
    note: r.note ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToChest(r: ChestRow): ChestRecord {
  return {
    id: r.id,
    pos: { x: r.x, y: r.y, z: r.z },
    dimension: r.dimension,
    label: r.label ?? undefined,
    lastIndexedAt: r.last_indexed_at,
  };
}

const dist = (a: Vec3Lit, b: Vec3Lit) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
