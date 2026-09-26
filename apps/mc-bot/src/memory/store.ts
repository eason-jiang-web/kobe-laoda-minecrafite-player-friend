import { Database } from "bun:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  askHint,
  DEFAULT_ASK_POLICY,
  profileBrief,
  profileDigest,
  type AdaptCount,
  type AskRecord,
  type ChestRecord,
  type HabitCount,
  type Lesson,
  type PlayerProfile,
  type Vec3Lit,
  type Waypoint,
  type WorldMemorySnapshot,
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
  /** 画像摘要写到哪 —— 大脑是另一个进程，只能读文件（和自修笔记一个套路）。 */
  private readonly digestPath?: string;
  private digestTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(dbPath: string, opts: { digestPath?: string } = {}) {
    this.db = new Database(dbPath, { create: true });
    this.digestPath = opts.digestPath;
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
    // 追问预算：同一个话题问了几次（见 packages/shared/src/ask-budget.ts）
    this.db.run(`CREATE TABLE IF NOT EXISTS asks (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      last_at INTEGER NOT NULL,
      last_question TEXT NOT NULL
    );`);
    // 他的习惯：指令次数、在线时段、说话长度……
    this.db.run(`CREATE TABLE IF NOT EXISTS habits (
      key TEXT PRIMARY KEY,
      n INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`);
    // 你的熟练度：每门本事试了几次、成了几次
    this.db.run(`CREATE TABLE IF NOT EXISTS adaptation (
      area TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL,
      successes INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`);
    // 一点点上下文（比如"他最后说了什么"）—— 追问额度按这个算，模型改名也没用
    this.db.run(`CREATE TABLE IF NOT EXISTS kv (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL,
      at INTEGER NOT NULL
    );`);
    // 教训 / 偏好（大脑自己写的）
    this.db.run(`CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      area TEXT NOT NULL,
      text TEXT NOT NULL,
      at INTEGER NOT NULL
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

  // ── 追问预算 ────────────────────────────────────────────────────────────

  askRecords(): AskRecord[] {
    const rows = this.db.query(`SELECT key,count,last_at,last_question FROM asks`).all() as Array<{
      key: string;
      count: number;
      last_at: number;
      last_question: string;
    }>;
    return rows.map((r) => ({
      key: r.key,
      count: r.count,
      lastAt: r.last_at,
      lastQuestion: r.last_question,
    }));
  }

  saveAskRecords(records: AskRecord[]): void {
    this.db.run(`DELETE FROM asks`);
    const ins = this.db.query(`INSERT INTO asks (key,count,last_at,last_question) VALUES ($k,$c,$t,$q)`);
    for (const r of records) {
      ins.run({ $k: r.key, $c: r.count, $t: r.lastAt, $q: r.lastQuestion });
    }
  }

  /** 「这件事别再问了」那行提示（有话题问满时才有）。 */
  askHintLine(now = Date.now()): string | null {
    return askHint(this.askRecords(), now, DEFAULT_ASK_POLICY);
  }

  setKv(k: string, v: string): void {
    this.db
      .query(
        `INSERT INTO kv (k,v,at) VALUES ($k,$v,$t)
         ON CONFLICT(k) DO UPDATE SET v = $v, at = $t`,
      )
      .run({ $k: k, $v: v, $t: Date.now() });
  }

  getKv(k: string): string | null {
    const row = this.db.query(`SELECT v FROM kv WHERE k=$k`).get({ $k: k }) as { v: string } | null;
    return row ? row.v : null;
  }

  // ── 他的习惯 / 你的熟练度 / 教训 ────────────────────────────────────────

  bumpHabit(key: string, by = 1): void {
    this.db
      .query(
        `INSERT INTO habits (key,n,updated_at) VALUES ($k,$n,$t)
         ON CONFLICT(key) DO UPDATE SET n = n + $n, updated_at = $t`,
      )
      .run({ $k: key, $n: by, $t: Date.now() });
    this.scheduleDigest();
  }

  noteOutcome(area: string, ok: boolean): void {
    this.db
      .query(
        `INSERT INTO adaptation (area,attempts,successes,updated_at) VALUES ($a,1,$s,$t)
         ON CONFLICT(area) DO UPDATE SET attempts = attempts + 1, successes = successes + $s, updated_at = $t`,
      )
      .run({ $a: area, $s: ok ? 1 : 0, $t: Date.now() });
    this.scheduleDigest();
  }

  addLesson(area: string, text: string): void {
    const clean = text.trim().slice(0, 200);
    if (clean.length === 0) return;
    // 同一句话只记一次 —— 重复记等于没记
    const dup = this.db.query(`SELECT id FROM lessons WHERE area=$a AND text=$t`).get({ $a: area, $t: clean });
    if (dup) return;
    this.db
      .query(`INSERT INTO lessons (area,text,at) VALUES ($a,$t,$now)`)
      .run({ $a: area, $t: clean, $now: Date.now() });
    this.scheduleDigest();
  }

  profile(lessonLimit = 20): PlayerProfile {
    const habits = this.db.query(`SELECT key,n,updated_at FROM habits`).all() as Array<{
      key: string;
      n: number;
      updated_at: number;
    }>;
    const adaptation = this.db.query(`SELECT area,attempts,successes,updated_at FROM adaptation`).all() as Array<{
      area: string;
      attempts: number;
      successes: number;
      updated_at: number;
    }>;
    const lessons = this.db
      .query(`SELECT area,text,at FROM lessons ORDER BY at DESC LIMIT $l`)
      .all({ $l: lessonLimit }) as Lesson[];
    return {
      habits: habits.map((h): HabitCount => ({ key: h.key, n: h.n, updatedAt: h.updated_at })),
      adaptation: adaptation.map(
        (a): AdaptCount => ({ area: a.area, attempts: a.attempts, successes: a.successes, updatedAt: a.updated_at }),
      ),
      lessons,
    };
  }

  /** 游戏里 #profile 那一句。 */
  briefText(): string {
    return profileBrief(this.profile());
  }

  /** 喂给大脑的那段（也写到 digestPath）。 */
  digestText(): string {
    return profileDigest(this.profile());
  }

  /**
   * 画像变了就把摘要写出去（防抖 1.5 秒 —— 习惯是高频写入，不能每句都落盘）。
   */
  private scheduleDigest(): void {
    if (!this.digestPath || this.digestTimer !== null) return;
    const timer = setTimeout(() => {
      this.digestTimer = null;
      this.writeDigest();
    }, 1500);
    (timer as unknown as { unref?: () => void }).unref?.();
    this.digestTimer = timer;
  }

  /** 立刻写一次，返回写出去的内容。 */
  writeDigest(): string {
    const text = this.digestText();
    if (this.digestPath) {
      try {
        mkdirSync(dirname(this.digestPath), { recursive: true });
        writeFileSync(this.digestPath, text, "utf8");
      } catch {
        // 摘要写不出去不该影响玩
      }
    }
    return text;
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
    if (this.digestTimer !== null) {
      clearTimeout(this.digestTimer);
      this.digestTimer = null;
      this.writeDigest();
    }
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
