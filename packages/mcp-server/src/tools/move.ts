import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MoveToInput, TeleportToPlayerInput, type BotControl } from "@itto/shared";
import { ok, fail } from "./_util.js";

export function registerMovementTools(server: McpServer, control: BotControl): void {
  server.tool(
    "move_to",
    "Pathfind to a coordinate. For long hops (>30 blocks) the bot teleports instead.",
    MoveToInput.shape,
    async ({ target, range, sprint }) => {
      try {
        await control.moveTo(target, { range, sprint });
        return ok(`moved toward (${target.x}, ${target.y}, ${target.z})`);
      } catch (e) {
        return fail(`couldn't reach target: ${(e as Error).message}`);
      }
    },
  );

  server.tool(
    "look_at",
    "Aim the bot's head at a coordinate (used to 'look at' the player or something pointed out).",
    MoveToInput.pick({ target: true }).shape,
    async ({ target }) => {
      try {
        await control.lookAt(target);
        return ok("looking");
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.tool(
    "teleport_to_player",
    "Instantly teleport next to the player (no walking) — use when he says come here / tp / 传送 / 瞬移过来, " +
      "or when you're lost and far away. Works even when the client can't see him (other dimension / out of range): " +
      "it then asks the SERVER to resolve the name. Needs command permission; if refused, it says what the server said.",
    TeleportToPlayerInput.shape,
    async ({ player }) => {
      if (control.isFreeRoam()) {
        return fail("他现在在自由活动（#free）—— 要叫他回来，先让他打 #back");
      }
      try {
        return ok(await control.teleportToPlayer(player));
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.tool(
    "stop",
    "Cancel current movement / action and stand still.",
    {},
    async () => {
      control.stop();
      return ok("stopped");
    },
  );
}
