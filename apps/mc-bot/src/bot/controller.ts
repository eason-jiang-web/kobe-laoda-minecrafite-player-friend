import type { Bot } from "mineflayer";
import { goals } from "mineflayer-pathfinder";
import { Vec3 } from "vec3";
import type {
  BlockQuery,
  BotControl,
  EntityInfo,
  GameState,
  LookedAtBlock,
  NotableBlock,
  Vec3Lit,
} from "@itto/shared";
import type { Config } from "../config.js";
import { extractGameState } from "../state/extract.js";
import { HOSTILE } from "../state/hostiles.js";
import { logger } from "../util/logger.js";

const log = logger("controller");

const round = (n: number) => Math.round(n * 100) / 100;
const toLit = (v: { x: number; y: number; z: number }): Vec3Lit => ({
  x: round(v.x),
  y: round(v.y),
  z: round(v.z),
});

/** Block names treated as the "any_stone" group. */
const STONE_NAMES = new Set([
  "stone", "cobblestone", "deepslate", "cobbled_deepslate", "andesite",
  "diorite", "granite", "tuff", "calcite", "blackstone", "basalt", "netherrack",
]);

/**
 * Concrete BotControl over a live Mineflayer bot. This is the ONE place that
 * touches Mineflayer's action APIs. Skills and MCP tools both go through here,
 * so behavior (and safety) stays consistent.
 */
export class BotController implements BotControl {
  /** Cache of friendly-name → block ids (the registry is static per session). */
  private blockIdCache = new Map<string, number[]>();

  constructor(
    private bot: Bot,
    private readonly cfg: Config,
  ) {}

  /**
   * Re-point this controller at a fresh Mineflayer connection after a
   * reconnect. Keeps the same controller instance (already injected into the
   * MCP server) so the brain's session survives the body swapping out.
   */
  rebind(bot: Bot): void {
    this.bot = bot;
    this.blockIdCache.clear();
  }

  async moveTo(target: Vec3Lit, opts?: { range?: number; sprint?: boolean }): Promise<void> {
    const range = opts?.range ?? 1;
    const here = this.bot.entity.position;
    const dist = here.distanceTo(new Vec3(target.x, target.y, target.z));

    // Long-haul fallback: teleport instead of pathing across the world.
    if (dist > this.cfg.tuning.teleportFallbackDistance) {
      log.debug(`dist ${dist.toFixed(1)} > fallback, teleporting`);
      return this.teleportTo(target);
    }

    const goal = new goals.GoalNear(target.x, target.y, target.z, range);
    await this.bot.pathfinder.goto(goal);
  }

  async teleportTo(target: Vec3Lit): Promise<void> {
    // Requires op. If the bot isn't op this is a no-op the server rejects;
    // the slow loop should know whether teleport is available.
    this.bot.chat(`/tp ${this.bot.username} ${target.x} ${target.y} ${target.z}`);
  }

  async lookAt(target: Vec3Lit): Promise<void> {
    await this.bot.lookAt(new Vec3(target.x, target.y + 1.6, target.z), true);
  }

  async mineBlock(pos: Vec3Lit): Promise<void> {
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    if (!block) throw new Error("no block at that position");
    await this.bot.dig(block);
  }

  async placeBlock(pos: Vec3Lit, item: string): Promise<void> {
    const ref = this.bot.blockAt(new Vec3(pos.x, pos.y - 1, pos.z));
    if (!ref) throw new Error("no reference block to place against");
    await this.equip(item);
    await this.bot.placeBlock(ref, new Vec3(0, 1, 0));
  }

  async dropItem(name: string, count?: number): Promise<void> {
    const item = this.bot.inventory.items().find((i) => i.name === name);
    if (!item) throw new Error(`no ${name} in inventory`);
    await this.bot.toss(item.type, null, count ?? item.count);
  }

  async equip(name: string, destination: "hand" | "head" | "torso" | "legs" | "feet" | "off-hand" = "hand"): Promise<void> {
    const item = this.bot.inventory.items().find((i) => i.name === name);
    if (!item) throw new Error(`no ${name} to equip`);
    await this.bot.equip(item, destination);
  }

  async attack(entityId: number): Promise<void> {
    const entity = this.bot.entities[entityId];
    if (!entity) throw new Error("entity gone");
    await this.bot.attack(entity);
  }

  async chat(message: string): Promise<void> {
    this.bot.chat(message);
  }

  getState(): GameState {
    return extractGameState(this.bot, this.cfg.mc.ownerUsername);
  }

  stop(): void {
    this.bot.pathfinder.stop();
    this.bot.clearControlStates();
  }

  // ── Perception ───────────────────────────────────────────────────────────

  async findBlocks(query: BlockQuery): Promise<Vec3Lit[]> {
    const ids = this.resolveBlockIds(query.name);
    if (ids.length === 0) return [];
    const found = this.bot.findBlocks({
      matching: ids,
      maxDistance: Math.min(query.maxDistance ?? 32, 64),
      count: query.count ?? 8,
      point: this.bot.entity.position,
    });
    return found.map(toLit);
  }

  async lookingAt(opts?: { player?: string; maxDistance?: number }): Promise<LookedAtBlock | null> {
    const username = opts?.player ?? this.cfg.mc.ownerUsername;
    const ent = this.bot.players[username]?.entity;
    if (!ent) return null;
    const block = this.bot.blockAtEntityCursor(ent, opts?.maxDistance ?? 6);
    if (!block || block.name === "air") return null;
    return { name: block.name, pos: toLit(block.position) };
  }

  async nearbyNotable(maxDistance = 24): Promise<NotableBlock[]> {
    const cats: Array<[string, NotableBlock["category"]]> = [
      ["any_log", "log"],
      ["any_ore", "ore"],
      ["water", "water"],
      ["any_chest", "chest"],
    ];
    const here = this.bot.entity.position;
    const out: NotableBlock[] = [];
    for (const [query, category] of cats) {
      const ids = this.resolveBlockIds(query);
      if (ids.length === 0) continue;
      const found = this.bot.findBlocks({ matching: ids, maxDistance, count: 3, point: here });
      for (const v of found) {
        const b = this.bot.blockAt(v);
        out.push({ name: b?.name ?? query, pos: toLit(v), distance: round(here.distanceTo(v)), category });
      }
    }
    return out.sort((a, b) => a.distance - b.distance).slice(0, 8);
  }

  playerHeading(player?: string): Vec3Lit | null {
    const username = player ?? this.cfg.mc.ownerUsername;
    const ent = this.bot.players[username]?.entity;
    if (!ent) return null;
    // Minecraft view direction (matches mineflayer's getViewDirection).
    const yaw = ent.yaw;
    const pitch = ent.pitch;
    const cp = Math.cos(pitch);
    return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
  }

  // ── Mid-level action primitives ──────────────────────────────────────────

  /** pathfinder.goto with a hard time cap so a stuck path can't hang a skill. */
  private gotoSafe(goal: Parameters<Bot["pathfinder"]["goto"]>[0], ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      const timer = setTimeout(() => {
        this.bot.pathfinder.stop();
        finish();
      }, ms);
      this.bot.pathfinder
        .goto(goal)
        .then(() => {
          clearTimeout(timer);
          finish();
        })
        .catch(() => {
          clearTimeout(timer);
          finish();
        });
    });
  }

  async digAt(pos: Vec3Lit): Promise<void> {
    const v = new Vec3(pos.x, pos.y, pos.z);
    const block = this.bot.blockAt(v);
    if (!block || block.name === "air") return;
    await this.gotoSafe(new goals.GoalGetToBlock(pos.x, pos.y, pos.z), 8000);
    const reach = this.bot.entity.position.distanceTo(v);
    if (reach > 4.5) return; // couldn't get close enough; skip rather than hang on dig
    const fresh = this.bot.blockAt(v);
    if (!fresh || fresh.name === "air") return;
    const tool = this.bot.pathfinder.bestHarvestTool(fresh);
    if (tool) await this.bot.equip(tool, "hand");
    await this.bot.dig(fresh);
  }

  async mineMany(positions: Vec3Lit[]): Promise<number> {
    let mined = 0;
    for (const p of positions) {
      try {
        await this.digAt(p);
        mined++;
      } catch (e) {
        log.debug(`mineMany skip (${p.x},${p.y},${p.z}): ${(e as Error).message}`);
      }
    }
    return mined;
  }

  async collectNearbyDrops(opts?: { radius?: number; timeoutMs?: number }): Promise<number> {
    // Entity-based pickup: walk onto tracked item entities so vanilla pickup
    // fires. NOTE: some servers/protocol versions don't surface item entities
    // in bot.entities; for skills that know where they mined, sweepColumns() is
    // the reliable collector. This stays best-effort for loose loot (combat).
    const radius = opts?.radius ?? 8;
    const timeoutMs = opts?.timeoutMs ?? 8000;
    const start = Date.now();
    let collected = 0;
    let lastId = -1;
    let attempts = 0;
    while (Date.now() - start < timeoutMs) {
      const here = this.bot.entity.position;
      const drop = this.bot.nearestEntity(
        (e) => e.name === "item" && e.position.distanceTo(here) <= radius,
      );
      if (!drop) break;
      if (drop.id === lastId) {
        if (++attempts >= 3) break;
      } else {
        lastId = drop.id;
        attempts = 0;
      }
      await this.gotoSafe(new goals.GoalNear(drop.position.x, drop.position.y, drop.position.z, 0), 4000);
      await new Promise((r) => setTimeout(r, 200));
      if (!this.bot.entities[drop.id]) collected++;
    }
    return collected;
  }

  async sweepColumns(positions: Vec3Lit[]): Promise<void> {
    // Walk the X/Z column of each mined block so vanilla auto-pickup grabs the
    // drops (they fall to the ground beneath where the block was). Works even
    // when item entities aren't tracked.
    const seen = new Set<string>();
    for (const p of positions) {
      const x = Math.floor(p.x);
      const z = Math.floor(p.z);
      const key = `${x},${z}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await this.gotoSafe(new goals.GoalNearXZ(x, z, 1), 4000);
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  async craft(itemName: string, count = 1): Promise<void> {
    const id = this.resolveItemId(itemName);
    if (id == null) throw new Error(`unknown item: ${itemName}`);

    const inHand = this.bot.recipesFor(id, null, count, null);
    if (inHand.length > 0) {
      await this.bot.craft(inHand[0]!, count, undefined);
      return;
    }

    const table = this.bot.findBlock({ matching: this.resolveBlockIds("crafting_table"), maxDistance: 32 });
    if (!table) throw new Error("need a crafting table and none is nearby");
    await this.bot.pathfinder.goto(new goals.GoalLookAtBlock(table.position, this.bot.world));
    const withTable = this.bot.recipesFor(id, null, count, table);
    if (withTable.length === 0) throw new Error(`can't craft ${itemName} (missing materials)`);
    await this.bot.craft(withTable[0]!, count, table);
  }

  nearestHostile(opts?: { maxDistance?: number; preferThreatTo?: Vec3Lit }): EntityInfo | null {
    const maxDistance = opts?.maxDistance ?? 16;
    const here = this.bot.entity.position;
    const ref = opts?.preferThreatTo
      ? new Vec3(opts.preferThreatTo.x, opts.preferThreatTo.y, opts.preferThreatTo.z)
      : here;
    const candidates = Object.values(this.bot.entities).filter(
      (e) => !!e.name && HOSTILE.has(e.name) && here.distanceTo(e.position) <= maxDistance,
    );
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => ref.distanceTo(a.position) - ref.distanceTo(b.position));
    const e = candidates[0]!;
    return { id: e.id, name: e.name!, pos: toLit(e.position), distance: round(here.distanceTo(e.position)) };
  }

  // ── Containers ───────────────────────────────────────────────────────────

  async readContainer(pos: Vec3Lit): Promise<Array<{ item: string; count: number }>> {
    const block = await this.reachContainer(pos);
    const container = await this.bot.openContainer(block);
    const items = container.containerItems().map((i) => ({ item: i.name, count: i.count }));
    container.close();
    return items;
  }

  /** Pathfind into reach of a container coord, or throw a clean error. */
  private async reachContainer(pos: Vec3Lit) {
    const v = new Vec3(pos.x, pos.y, pos.z);
    const block = this.bot.blockAt(v);
    if (!block) throw new Error("no block at that position");
    await this.gotoSafe(new goals.GoalGetToBlock(pos.x, pos.y, pos.z), 10000);
    if (this.bot.entity.position.distanceTo(v) > 4.5) {
      throw new Error(`couldn't reach the container at (${pos.x}, ${pos.y}, ${pos.z})`);
    }
    return block;
  }

  async withdrawFromContainer(pos: Vec3Lit, item: string, count?: number): Promise<number> {
    const id = this.resolveItemId(item);
    if (id == null) throw new Error(`unknown item: ${item}`);
    const block = await this.reachContainer(pos);
    const container = await this.bot.openContainer(block);
    try {
      const match = container.containerItems().find((i) => i.type === id);
      if (!match) return 0;
      const take = Math.min(count ?? match.count, match.count);
      await container.withdraw(match.type, null, take);
      return take;
    } finally {
      container.close();
    }
  }

  dimension(): string {
    return this.bot.game.dimension;
  }

  // ── Name resolution ──────────────────────────────────────────────────────

  /** Map a friendly block name or group alias to concrete block ids. */
  private resolveBlockIds(name: string): number[] {
    const key = name.toLowerCase();
    const cached = this.blockIdCache.get(key);
    if (cached) return cached;

    const reg = this.bot.registry;
    const all = reg.blocksArray as Array<{ id: number; name: string }>;
    let ids: number[];
    switch (key) {
      case "any_log":
        ids = all.filter((b) => /(_log|_wood|_stem|_hyphae)$/.test(b.name)).map((b) => b.id);
        break;
      case "any_wood":
        ids = all.filter((b) => /(_log|_wood|_stem|_hyphae|_planks)$/.test(b.name)).map((b) => b.id);
        break;
      case "any_ore":
        ids = all.filter((b) => b.name.endsWith("_ore") || b.name === "ancient_debris").map((b) => b.id);
        break;
      case "any_stone":
        ids = all.filter((b) => STONE_NAMES.has(b.name)).map((b) => b.id);
        break;
      case "any_chest":
        ids = all
          .filter((b) => b.name === "chest" || b.name === "trapped_chest" || b.name === "barrel")
          .map((b) => b.id);
        break;
      default: {
        const b = reg.blocksByName[key];
        ids = b ? [b.id] : [];
      }
    }
    this.blockIdCache.set(key, ids);
    return ids;
  }

  private resolveItemId(name: string): number | null {
    const it = this.bot.registry.itemsByName[name];
    return it ? it.id : null;
  }
}
