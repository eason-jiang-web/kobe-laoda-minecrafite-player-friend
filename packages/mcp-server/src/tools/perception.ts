import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FindBlocksInput, LookDetectInput, NearbyNotableInput, type BotControl } from "@itto/shared";
import { ok, fail } from "./_util.js";

/**
 * Perception tools — the bot's "eyes". On-demand so the per-tick GameState
 * snapshot stays token-cheap; the agent calls these when it actually needs to
 * locate something or check what the player is pointing at.
 */
export function registerPerceptionTools(server: McpServer, control: BotControl): void {
  server.tool(
    "find_blocks",
    "Find nearby blocks by name. Accepts a concrete name ('oak_log','diamond_ore','crafting_table') or a group alias ('any_log','any_ore','any_wood','any_stone','any_chest'). Returns coordinates, nearest first.",
    FindBlocksInput.shape,
    async ({ name, maxDistance, count }) => {
      try {
        const coords = await control.findBlocks({ name, maxDistance, count });
        if (coords.length === 0) return ok(`no ${name} within range`, []);
        const list = coords.map((c) => `(${c.x}, ${c.y}, ${c.z})`).join(", ");
        return ok(`found ${coords.length} ${name}: ${list}`, coords);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.tool(
    "look_detect",
    "What block is the player currently looking at (raycast from their eyes)? Use for 'look at this' / 'what's that'.",
    LookDetectInput.shape,
    async ({ player, maxDistance }) => {
      try {
        const block = await control.lookingAt({ player, maxDistance });
        if (!block) return ok("not looking at any block", null);
        return ok(`looking at ${block.name} at (${block.pos.x}, ${block.pos.y}, ${block.pos.z})`, block);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.tool(
    "nearby_blocks",
    "Quick scan of notable blocks nearby (logs, ores, water, chests). Cheap situational awareness.",
    NearbyNotableInput.shape,
    async ({ maxDistance }) => {
      try {
        const notable = await control.nearbyNotable(maxDistance);
        if (notable.length === 0) return ok("nothing notable nearby", []);
        const summary = notable.map((n) => `${n.name}@${n.distance}b`).join(", ");
        return ok(summary, notable);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );
}
