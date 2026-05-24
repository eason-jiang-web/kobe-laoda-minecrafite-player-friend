import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ok, fail } from "@itto/mcp-server";
import {
  ForgetLocationInput,
  IndexChestInput,
  RecallLocationsInput,
  RememberLocationInput,
  type BotControl,
} from "@itto/shared";
import type { WorldMemory } from "./store.js";

/**
 * MCP tools + resource for itto's world memory. Registered app-side (they hold
 * the WorldMemory + need the live BotControl), like the skill tools — keeps the
 * mcp-server package free of app state.
 */
export function registerMemoryTools(server: McpServer, memory: WorldMemory, control: BotControl): void {
  server.tool(
    "remember_location",
    "Remember a named place (base, chest, point of interest). Defaults to the bot's current position if no coords given.",
    RememberLocationInput.shape,
    async ({ name, pos, kind, note }) => {
      try {
        const at = pos ?? control.getState().self.pos;
        const wp = memory.rememberLocation({ name, pos: at, dimension: control.dimension(), kind, note });
        return ok(`remembered ${wp.name} at (${wp.pos.x}, ${wp.pos.y}, ${wp.pos.z})`, wp);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.tool(
    "recall_locations",
    "List remembered places, optionally filtered by kind and sorted by distance to a coord.",
    RecallLocationsInput.shape,
    async ({ kind, near, limit }) => {
      try {
        const wps = memory.recallLocations({ kind, near, limit });
        if (wps.length === 0) return ok("nothing remembered yet", []);
        const list = wps.map((w) => `${w.name} (${w.kind}) @ (${w.pos.x}, ${w.pos.y}, ${w.pos.z})`).join("; ");
        return ok(list, wps);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.tool(
    "index_chest",
    "Open the chest at a coord, read its contents, and remember what's in it (so fetch_item can find things later).",
    IndexChestInput.shape,
    async ({ pos, label }) => {
      try {
        const contents = await control.readContainer(pos);
        const chest = memory.indexChest({ pos, dimension: control.dimension(), label, contents });
        const summary = contents.length ? contents.map((c) => `${c.item}x${c.count}`).join(", ") : "empty";
        return ok(`indexed chest at (${pos.x}, ${pos.y}, ${pos.z}): ${summary}`, chest);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.tool(
    "forget_location",
    "Forget a remembered place by name.",
    ForgetLocationInput.shape,
    async ({ name }) => {
      const removed = memory.forgetLocation(name);
      return removed ? ok(`forgot ${name}`) : fail(`no place named ${name}`);
    },
  );

  server.resource(
    "world-memory",
    "itto://memory/world",
    {
      description: "Everything itto remembers about this world: waypoints, chest contents, notes (JSON).",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(memory.snapshot(), null, 2),
        },
      ],
    }),
  );
}
