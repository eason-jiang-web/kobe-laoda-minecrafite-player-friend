/**
 * Core shared types. These are the contract between the bot runtime
 * (apps/mc-bot) and the MCP surface (packages/mcp-server). Keep them
 * compact — the GameState object gets serialized to JSON and read by
 * Claude (via Hermes) on every slow-loop tick, so every field costs tokens.
 */

/** A plain {x,y,z} — we never pass Mineflayer's Vec3 class across boundaries. */
export interface Vec3Lit {
  x: number;
  y: number;
  z: number;
}

export interface EntityInfo {
  id: number;
  /** e.g. "zombie", "creeper", "skeleton" */
  name: string;
  pos: Vec3Lit;
  /** blocks from the bot, rounded to 1 decimal */
  distance: number;
}

/** The block a player is currently looking at (raycast from their eyes). */
export interface LookedAtBlock {
  name: string;
  pos: Vec3Lit;
}

/** One notable block surfaced by the cheap nearby scan. */
export interface NotableBlock {
  name: string;
  pos: Vec3Lit;
  distance: number;
  category: "log" | "ore" | "water" | "chest" | "other";
}

/**
 * On-demand block search request. `name` accepts a concrete block name
 * ("oak_log", "diamond_ore") or a group alias ("any_log", "any_ore",
 * "any_wood", "any_stone", "any_chest").
 */
export interface BlockQuery {
  name: string;
  maxDistance?: number;
  count?: number;
}

/** Compact placement spec for build_helper. */
export interface PlacementSpec {
  placements: Array<{ pos: Vec3Lit; item: string }>;
}

export interface InventoryItem {
  name: string;
  count: number;
  /** equipped slot, if any: "hand" | "head" | "torso" | ... */
  slot?: string;
}

export interface ChatLine {
  username: string;
  message: string;
  /** epoch ms */
  at: number;
}

/** Follow-behavior state machine states. See apps/mc-bot/src/fast-loop/follow.ts */
export type FollowState = "IDLE" | "DRIFT" | "CATCHUP" | "TASK";

/**
 * The compact world snapshot. Produced every tick by the state extractor,
 * surfaced to Hermes/Claude as an MCP resource, and used by the slow loop
 * to decide whether anything is worth commenting on.
 */
export interface GameState {
  /** ms since this snapshot was taken */
  at: number;
  /** 0–24000 game ticks; <13000 is day */
  timeOfDay: number;
  self: {
    pos: Vec3Lit;
    vel: Vec3Lit;
    health: number; // 0–20
    food: number; // 0–20
    heldItem: string | null;
    /** Block the OWNER is currently looking at, if any (for "look at this"). */
    lookingAt?: string | null;
    /** Held tool durability, if the held item is damageable. */
    heldDurability?: { current: number; max: number };
    onGround: boolean;
    dimension: string;
  };
  player: {
    username: string;
    pos: Vec3Lit | null;
    /** blocks between bot and player, null if player not visible */
    distance: number | null;
    online: boolean;
  } | null;
  nearbyHostiles: EntityInfo[];
  recentChat: ChatLine[];
  inventory: InventoryItem[];
  followState: FollowState;
  /** The goal itto is currently pursuing (set by the brain via set_goal), if any. */
  currentGoal: { id: string; label: string; status: GoalStatus; progress?: string } | null;
}

/**
 * High-level intent the slow loop / brain hands down to the goal runner.
 * The fast loop never produces these — it only reacts.
 */
export type BotIntent =
  | { kind: "say"; text: string }
  | { kind: "skill"; name: string; args?: Record<string, unknown> }
  | { kind: "follow"; range?: number }
  | { kind: "stop" };

export type GoalStatus = "active" | "done" | "failed" | "cancelled";

/** A goal the brain set for itto to pursue across many ticks. */
export interface BotGoal {
  id: string;
  intent: BotIntent;
  /** Short human/LLM summary, e.g. "fetch 3 iron from the ore chest". */
  label: string;
  status: GoalStatus;
  createdAt: number;
  updatedAt: number;
  progress?: string;
  error?: string;
}

/** Result envelope returned by every MCP tool, kept uniform for Hermes. */
export interface ToolResult {
  ok: boolean;
  message: string;
  data?: unknown;
}

// ── World memory (MC-specific spatial/factual store) ──

/** A named place itto remembers: base, chest, point of interest, portal, spawn. */
export interface Waypoint {
  id: number;
  name: string;
  pos: Vec3Lit;
  dimension: string;
  kind: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChestRecord {
  id: number;
  pos: Vec3Lit;
  dimension: string;
  label?: string;
  lastIndexedAt: number;
}

export interface ChestItem {
  chestId: number;
  item: string;
  count: number;
}

/** What recall_locations / itto://memory/world surface to the brain. */
export interface WorldMemorySnapshot {
  waypoints: Waypoint[];
  chests: Array<ChestRecord & { contents: Array<{ item: string; count: number }> }>;
  notes: Array<{ id: number; text: string; at: number; session: string }>;
}
