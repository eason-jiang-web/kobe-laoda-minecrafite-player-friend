import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CraftItemInput, type BotControl } from "@itto/shared";
import { ok, fail } from "./_util.js";

/**
 * Crafting tools. The controller handles finding/using a crafting table when
 * the recipe needs one, so this stays a thin primitive.
 */
export function registerCraftingTools(server: McpServer, control: BotControl): void {
  server.tool(
    "craft_item",
    "Craft an item by name (auto-uses a nearby crafting table if the recipe needs one).",
    CraftItemInput.shape,
    async ({ item, count }) => {
      try {
        await control.craft(item, count);
        return ok(`crafted ${count ?? 1} ${item}`);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );
}
