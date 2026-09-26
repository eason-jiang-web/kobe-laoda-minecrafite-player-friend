import { z } from "zod";

/**
 * Zod schemas for MCP tool inputs. The MCP server uses these both for
 * runtime validation and to advertise JSON Schema to Hermes/Claude.
 * Keep names + descriptions tool-call friendly — Claude reads them.
 */

export const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const MoveToInput = z.object({
  target: Vec3Schema.describe("World coordinate to move toward"),
  range: z.number().optional().describe("Stop when within this many blocks (default 1)"),
  sprint: z.boolean().optional().describe("Sprint there (default false)"),
});

export const TeleportToPlayerInput = z.object({
  player: z
    .string()
    .optional()
    .describe("Whose side to appear next to (default: your owner, eason). Another player's name works too."),
});

export const MineBlockInput = z.object({
  pos: Vec3Schema.describe("Coordinate of the block to mine"),
});

export const PlaceBlockInput = z.object({
  pos: Vec3Schema.describe("Coordinate to place the block at"),
  item: z.string().describe("Inventory item name to place, e.g. 'cobblestone'"),
});

export const DropItemInput = z.object({
  name: z.string().describe("Item to drop, e.g. 'iron_ingot'"),
  count: z.number().int().positive().optional().describe("How many (default all)"),
});

export const EquipInput = z.object({
  name: z.string().describe("Item to equip, e.g. 'diamond_sword'"),
  destination: z
    .enum(["hand", "head", "torso", "legs", "feet", "off-hand"])
    .optional()
    .describe("Where to equip it (default hand)"),
});

export const ChatInput = z.object({
  message: z.string().describe("Message to send in Minecraft chat"),
});

export const RunServerCommandInput = z.object({
  command: z
    .string()
    .describe(
      "Minecraft server command to run through the chat bar, slash optional. e.g. 'time set day', '/weather clear', 'give eason diamond 3'",
    ),
});

export const RunSkillInput = z.object({
  name: z.string().describe("Skill name, e.g. 'assist_mining'"),
  args: z.record(z.unknown()).optional().describe("Skill-specific arguments"),
});

// ── Perception (M1) ──

export const FindBlocksInput = z.object({
  name: z
    .string()
    .describe(
      "Block to find: concrete ('oak_log','diamond_ore','crafting_table') or a group alias ('any_log','any_ore','any_wood','any_stone','any_chest').",
    ),
  maxDistance: z.number().optional().describe("Search radius in blocks (default 32, max 64)"),
  count: z.number().int().positive().optional().describe("Max results to return (default 8)"),
});

export const LookDetectInput = z.object({
  player: z.string().optional().describe("Whose gaze to read (default the owner)"),
  maxDistance: z.number().optional().describe("Max ray distance in blocks (default 6)"),
});

export const NearbyNotableInput = z.object({
  maxDistance: z.number().optional().describe("Scan radius in blocks (default 24)"),
});

// ── Crafting + building (M2) ──

export const CraftItemInput = z.object({
  item: z.string().describe("Item to craft, e.g. 'crafting_table','stick','oak_planks','chest'"),
  count: z.number().int().positive().optional().describe("How many to craft (default 1)"),
});

export const PlacementSpecInput = z.object({
  placements: z
    .array(z.object({ pos: Vec3Schema, item: z.string() }))
    .min(1)
    .describe("Blocks to place: list of { pos, item }"),
});

export type MoveToInputT = z.infer<typeof MoveToInput>;
export type MineBlockInputT = z.infer<typeof MineBlockInput>;
export type PlaceBlockInputT = z.infer<typeof PlaceBlockInput>;
export type DropItemInputT = z.infer<typeof DropItemInput>;
export type EquipInputT = z.infer<typeof EquipInput>;
export type ChatInputT = z.infer<typeof ChatInput>;
export type RunSkillInputT = z.infer<typeof RunSkillInput>;
export type FindBlocksInputT = z.infer<typeof FindBlocksInput>;
export type LookDetectInputT = z.infer<typeof LookDetectInput>;
export type NearbyNotableInputT = z.infer<typeof NearbyNotableInput>;
export type CraftItemInputT = z.infer<typeof CraftItemInput>;
export type PlacementSpecInputT = z.infer<typeof PlacementSpecInput>;

// ── World memory (M3) ──

export const RememberLocationInput = z.object({
  name: z.string().describe("Short stable name, e.g. 'home_base' or 'ore_chest'"),
  pos: Vec3Schema.optional().describe("Coords; defaults to the bot's current position"),
  kind: z
    .enum(["base", "chest", "poi", "spawn", "portal"])
    .optional()
    .describe("Category (default 'poi')"),
  note: z.string().optional().describe("Freeform note about this place"),
});

export const RecallLocationsInput = z.object({
  kind: z.string().optional().describe("Filter by category"),
  near: Vec3Schema.optional().describe("Sort results by distance to this coord"),
  limit: z.number().int().positive().optional().describe("Max results (default 20)"),
});

export const IndexChestInput = z.object({
  pos: Vec3Schema.describe("Coords of the chest block to scan + remember"),
  label: z.string().optional().describe("Optional human name for the chest"),
});

export const ForgetLocationInput = z.object({
  name: z.string().describe("Name of the waypoint to forget"),
});

export type RememberLocationInputT = z.infer<typeof RememberLocationInput>;
export type RecallLocationsInputT = z.infer<typeof RecallLocationsInput>;
export type IndexChestInputT = z.infer<typeof IndexChestInput>;
export type ForgetLocationInputT = z.infer<typeof ForgetLocationInput>;

// ── Goals / intents (M4) ──

export const BotIntentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("say"), text: z.string().describe("Line to say in MC chat") }),
  z.object({
    kind: z.literal("skill"),
    name: z.string().describe("Skill to run, e.g. 'chop_tree'"),
    args: z.record(z.unknown()).optional().describe("Skill-specific args"),
  }),
  z.object({ kind: z.literal("follow"), range: z.number().optional().describe("Follow distance in blocks") }),
  z.object({ kind: z.literal("stop") }),
  z.object({
    kind: z.literal("collect"),
    item: z.string().describe("Item id to gather, e.g. 'oak_log', 'cobblestone', 'raw_iron'"),
    count: z.number().int().positive().describe("How many you need before the task counts as done"),
  }),
  z.object({
    kind: z.literal("deliver"),
    items: z
      .array(z.object({ name: z.string(), count: z.number().int().positive() }))
      .describe("Items to hand to the player — must already be in your inventory"),
  }),
]);

export const SetGoalInput = z.object({
  intent: BotIntentSchema.describe("What to pursue: run a skill, follow, say a line, or stop"),
  label: z.string().describe("Short human-readable summary of the goal, e.g. 'get wood'"),
});

export type SetGoalInputT = z.infer<typeof SetGoalInput>;

// ── Memory: free-form notes ──
// Cheap long-term memory for things that aren't places or chests: "eason is
// saving for a castle", "we still owe the nether trip". The brain writes them;
// they come back in itto://memory/world.

export const RememberNoteInput = z.object({
  text: z.string().describe("Short free-form note worth remembering across sessions"),
});

export const WikiNotesInput = z.object({
  topic: z
    .string()
    .optional()
    .describe("Which studied topic to read back (e.g. 僵尸 / 刷怪塔). Omit to get the list of everything studied."),
});

export const WikiLookupInput = z.object({
  query: z
    .string()
    .describe("What to look up on the Minecraft Wiki, e.g. 刷怪塔 / 僵尸 / 附魔台 / iron golem farm. Chinese or English."),
  lang: z
    .enum(["zh", "en"])
    .optional()
    .describe("Wiki language (default zh — same as how you talk to him). Use en when the Chinese page is thin."),
});

export const RecallNotesInput = z.object({
  limit: z.number().int().positive().optional().describe("How many recent notes (default 10, max 50)"),
});

// （语音相关的东西已经删掉了：牢大只在游戏聊天里说话。）
