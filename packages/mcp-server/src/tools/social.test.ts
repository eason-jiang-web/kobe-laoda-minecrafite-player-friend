import { describe, expect, test } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BotControl } from "@itto/shared";
import { looksLikeCommand, registerSocialTools } from "./social.js";

type Handler = (args: Record<string, unknown>) => Promise<{ isError?: boolean; content: Array<{ text: string }> }>;

/** 抓出注册进去的 handler —— 不用真的起一个 MCP server 也能测工具行为。 */
function capture(): { handlers: Record<string, Handler>; said: string[] } {
  const handlers: Record<string, Handler> = {};
  const said: string[] = [];
  const fakeServer = {
    tool: (name: string, _desc: string, _shape: unknown, handler: Handler) => {
      handlers[name] = handler;
    },
  } as unknown as McpServer;
  const control = {
    chat: async (m: string) => {
      said.push(m);
    },
    runServerCommand: async (c: string) => "ran " + c,
  } as unknown as BotControl;
  registerSocialTools(fakeServer, control);
  return { handlers, said };
}

describe("looksLikeCommand", () => {
  test("spots a command, including with leading spaces", () => {
    expect(looksLikeCommand("/fill ~ ~ ~ ~9 ~9 ~9 air")).toBe(true);
    expect(looksLikeCommand("   /op Laoda")).toBe(true);
  });

  test("plain talk is not a command", () => {
    expect(looksLikeCommand("走了兄弟")).toBe(false);
    expect(looksLikeCommand("#back")).toBe(false); // 硬命令不是服务器指令
    expect(looksLikeCommand("http://x")).toBe(false);
  });
});

describe("chat tool", () => {
  test("refuses anything starting with / — that's server_command's job", async () => {
    const { handlers, said } = capture();
    const res = await handlers.chat!({ message: "/fill ~ ~ ~ ~9 ~9 ~9 air" });
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("server_command");
    expect(said.length).toBe(0); // 一个字都没发出去
  });

  test("lets normal chat through", async () => {
    const { handlers, said } = capture();
    const res = await handlers.chat!({ message: "走了兄弟" });
    expect(res.isError).toBeFalsy();
    expect(said).toEqual(["走了兄弟"]);
  });

  test("server_command still runs (through the allow-list)", async () => {
    const { handlers } = capture();
    const res = await handlers.server_command!({ command: "time set day" });
    expect(res.content[0]!.text).toContain("ran time set day");
  });
});
