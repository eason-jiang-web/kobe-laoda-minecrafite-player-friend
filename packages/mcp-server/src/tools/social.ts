import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChatInput, RunServerCommandInput, type BotControl } from "@itto/shared";
import { ok, fail } from "./_util.js";

/**
 * "Social" tools — the bot communicating. Voice replies are handled by
 * Hermes' Discord plugin directly; this is the in-game text-chat path
 * (useful when not in a call, or for /commands).
 */
/**
 * "/fill ~ ~ ~ ~9 ~9 ~9 air" 这种：聊天工具**不该**能发指令。
 *
 * Minecraft 里聊天栏打成 "/xxx" 就是执行指令，所以只靠"聊天工具"这一个入口就能
 * 绕过 server_command 的白名单 —— 白名单本来就是为了防它把家拆了。这里拦死，
 * 想执行指令请走 server_command（那边有白名单 + 会读服务端回执）。
 */
export function looksLikeCommand(message: string): boolean {
  return message.trimStart().startsWith("/");
}

export function registerSocialTools(server: McpServer, control: BotControl): void {
  server.tool(
    "chat",
    "Send a message in Minecraft text chat. Plain talk only — a leading / is refused; " +
      "use server_command for actual commands (it enforces the allow-list).",
    ChatInput.shape,
    async ({ message }) => {
      if (looksLikeCommand(message)) {
        return fail(
          "这条以 / 开头 —— 那是服务器指令，得走 server_command（那边有白名单、会读服务端回执）。" +
            "chat 只负责说话。",
        );
      }
      try {
        await control.chat(message);
        return ok("sent");
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.tool(
    "server_command",
    "Run a Minecraft server command through the chat bar — 'time set day', '/weather clear', 'give eason diamond 3'. " +
      "REQUIRES the bot to be server op, and only allow-listed commands run (a refusal lists what is allowed). " +
      "The server's own reply is returned with the result, so you can tell the player what actually happened.",
    RunServerCommandInput.shape,
    async ({ command }) => {
      try {
        return ok(await control.runServerCommand(command));
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );
}
