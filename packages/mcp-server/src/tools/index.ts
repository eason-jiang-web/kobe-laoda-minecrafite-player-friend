import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BotControl } from "@itto/shared";
import { registerMovementTools } from "./move.js";
import { registerWorldTools } from "./world.js";
import { registerInventoryTools } from "./inventory.js";
import { registerSocialTools } from "./social.js";
import { registerPerceptionTools } from "./perception.js";
import { registerCraftingTools } from "./crafting.js";

/**
 * Register every MCP tool against the live bot control surface.
 * Each module groups related tools so the file stays readable as the
 * surface grows.
 */
export function registerTools(server: McpServer, control: BotControl): void {
  registerMovementTools(server, control);
  registerWorldTools(server, control);
  registerInventoryTools(server, control);
  registerSocialTools(server, control);
  registerPerceptionTools(server, control);
  registerCraftingTools(server, control);
}
