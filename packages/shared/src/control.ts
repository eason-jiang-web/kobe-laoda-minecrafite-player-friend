import type {
  BlockQuery,
  EntityInfo,
  GameState,
  LookedAtBlock,
  NotableBlock,
  Vec3Lit,
} from "./types.js";

/**
 * The single control surface over the Mineflayer bot.
 *
 * Implemented once in apps/mc-bot (src/bot/controller.ts) against a live
 * Mineflayer instance, then injected into:
 *   - the skill executor (apps/mc-bot/src/skills)
 *   - the MCP tools (packages/mcp-server/src/tools)
 *
 * Defining it here keeps the dependency arrow pointing the right way:
 * mcp-server depends on @itto/shared (this interface), never on the app.
 */
export interface BotControl {
  /** Pathfind to within `range` blocks of target. Sprint optional. */
  moveTo(target: Vec3Lit, opts?: { range?: number; sprint?: boolean }): Promise<void>;

  /** `/tp` style snap — only works if the bot is server op. Used as the >30 block fallback. */
  teleportTo(target: Vec3Lit): Promise<void>;

  /** Aim the bot's head at a point (for "look at player" idle + pointing). */
  lookAt(target: Vec3Lit): Promise<void>;

  mineBlock(pos: Vec3Lit): Promise<void>;
  placeBlock(pos: Vec3Lit, item: string): Promise<void>;
  dropItem(name: string, count?: number): Promise<void>;
  equip(name: string, destination?: "hand" | "head" | "torso" | "legs" | "feet" | "off-hand"): Promise<void>;
  attack(entityId: number): Promise<void>;

  /** Send an in-game chat message (text channel, not Discord voice). */
  chat(message: string): Promise<void>;

  /** Latest compact world snapshot. Cheap — read from cached game state. */
  getState(): GameState;

  /** Cancel any in-flight pathfinding / actions. The fast loop calls this on safety overrides. */
  stop(): void;

  // ── Perception (on-demand; kept OUT of GameState to stay token-cheap) ──

  /** Search nearby blocks by friendly name/alias. Returns coords, nearest-first. */
  findBlocks(query: BlockQuery): Promise<Vec3Lit[]>;

  /** What block the given player (default owner) is looking at, within maxDistance. */
  lookingAt(opts?: { player?: string; maxDistance?: number }): Promise<LookedAtBlock | null>;

  /** Cheap nearest-notable scan (logs/ores/water/chests). */
  nearbyNotable(maxDistance?: number): Promise<NotableBlock[]>;

  /** Unit direction the owner is facing (from yaw/pitch). For scouting ahead. */
  playerHeading(player?: string): Vec3Lit | null;

  // ── Mid-level action primitives (path-aware; composed by skills) ──

  /** Pathfind adjacent to a block and mine it (auto-equips the best tool). */
  digAt(pos: Vec3Lit): Promise<void>;

  /** Path to + mine a list of coords in order, best-effort. Returns count mined. */
  mineMany(positions: Vec3Lit[]): Promise<number>;

  /** Walk to + pick up dropped item entities within radius. Returns count collected. */
  collectNearbyDrops(opts?: { radius?: number; timeoutMs?: number }): Promise<number>;

  /** Walk the X/Z columns of mined blocks so vanilla pickup grabs the drops. */
  sweepColumns(positions: Vec3Lit[]): Promise<void>;

  /** Craft `count` of an item by name; finds/uses a nearby crafting table if needed. */
  craft(itemName: string, count?: number): Promise<void>;

  /** Nearest hostile mob, optionally ranked by threat to a point (the player). */
  nearestHostile(opts?: { maxDistance?: number; preferThreatTo?: Vec3Lit }): EntityInfo | null;

  // ── Containers (M3 world memory) ──

  /** Open a container at a coord, read its contents, close it. Container-side items only. */
  readContainer(pos: Vec3Lit): Promise<Array<{ item: string; count: number }>>;

  /** Open a container, withdraw up to `count` of `item`, close it. Returns amount taken. */
  withdrawFromContainer(pos: Vec3Lit, item: string, count?: number): Promise<number>;

  /** Current dimension string ("overworld" | "the_nether" | "the_end"). */
  dimension(): string;
}
