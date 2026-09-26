import { describe, expect, test } from "bun:test";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BotControl } from "@itto/shared";
import { WorldMemory } from "./store.js";
import { registerMemoryTools } from "./tools.js";

/**
 * 这一层用假服务器 + 假身体测：注册进去的**是真的** handler，
 * 预算判断、落盘、以及"到底有没有在游戏里说出去"全都是真的。
 */

type Result = { content: Array<{ type: string; text: string }>; isError?: boolean };
type Handler = (args: Record<string, unknown>) => Promise<Result>;
type ResourceHandler = (uri: URL) => Promise<{ contents: Array<{ text?: string }> }>;

class FakeServer {
  readonly tools = new Map<string, Handler>();
  readonly resources = new Map<string, ResourceHandler>();

  tool(name: string, _desc: string, _shape: unknown, handler: Handler): void {
    this.tools.set(name, handler);
  }

  resource(_name: string, uri: string, _meta: unknown, handler: ResourceHandler): void {
    this.resources.set(uri, handler);
  }

  call(name: string, args: Record<string, unknown> = {}): Promise<Result> {
    const h = this.tools.get(name);
    if (!h) throw new Error("no such tool: " + name);
    return h(args);
  }
}

function setup() {
  const server = new FakeServer();
  const memory = new WorldMemory(":memory:");
  /** 游戏里真正说出去的话（假身体的"嘴"）。 */
  const said: string[] = [];
  const control = {
    chat: async (m: string) => {
      said.push(m);
    },
  } as unknown as BotControl;
  registerMemoryTools(server as unknown as McpServer, memory, control);
  return { server, memory, said };
}

const textOf = (r: Result) => r.content.map((c) => c.text).join("\n");

describe("ask_player —— 同一件事最多问三次", () => {
  test("前三次真的问出去，第四次被拦下来且一个字都不说", async () => {
    const { server, said } = setup();
    for (let i = 1; i <= 3; i++) {
      const r = await server.call("ask_player", { question: "去哪个地方？", topic: "去哪" });
      expect(r.isError).toBeFalsy();
      expect(textOf(r)).toContain(`asked (${i}/3)`);
    }
    expect(said.length).toBe(3);

    const fourth = await server.call("ask_player", { question: "到底去哪个地方？", topic: "去哪" });
    expect(fourth.isError).toBe(true);
    expect(textOf(fourth)).toContain("已经问过 3 次");
    expect(textOf(fourth)).toContain("直接开工");
    // 关键：被拦的那次**没有**在游戏里说话，也没进聊天记录
    expect(said.length).toBe(3);
    expect(said.some((m) => m.includes("到底"))).toBe(false);
  });

  test("模型给同一件事换名字也绕不过去（按他最后那句话记账）", async () => {
    const { server, memory, said } = setup();
    // 身体记下了玩家最后说的那句话 —— 之后不管模型怎么起 topic，都算同一件事
    memory.setKv("last_request", "去那边挖点矿");
    const a = await server.call("ask_player", { question: "哪边？", topic: "挖矿方向" });
    const b = await server.call("ask_player", { question: "到底是哪边？", topic: "wheretomine" });
    expect(textOf(a)).toContain("asked (1/3)");
    expect(textOf(b)).toContain("asked (2/3)");

    await server.call("ask_player", { question: "再确认下哪边？", topic: "方向确认" });
    const fourth = await server.call("ask_player", { question: "哪边啊？", topic: "随便起个名" });
    expect(fourth.isError).toBe(true);
    expect(said.length).toBe(3); // 第四次一个字都没说
  });

  test("玩家换了新话题就重新给额度", async () => {
    const { server, memory } = setup();
    memory.setKv("last_request", "去那边挖点矿");
    for (let i = 0; i < 3; i++) await server.call("ask_player", { question: "哪边？", topic: "t" });
    expect((await server.call("ask_player", { question: "哪边？", topic: "t" })).isError).toBe(true);

    // 他说了件新事（比如"帮我把这些木头搬回基地"）→ 之前的账不再算数
    memory.setKv("last_request", "帮我把这些木头搬回基地");
    const fresh = await server.call("ask_player", { question: "哪个箱子？", topic: "t" });
    expect(fresh.isError).toBeFalsy();
  });

  test("换个话题还能正常问（没有 last_request 时按 topic 算）", async () => {
    const { server } = setup();
    for (let i = 0; i < 3; i++) await server.call("ask_player", { question: "去哪？", topic: "去哪" });
    const other = await server.call("ask_player", { question: "先挖矿还是先盖房？", topic: "今天干嘛" });
    expect(other.isError).toBeFalsy();
  });

  test("问题太长会被截断，不会撑爆聊天栏", async () => {
    const { server, said } = setup();
    await server.call("ask_player", { question: "啊".repeat(400), topic: "长问题" });
    expect(said[0]!.length).toBeLessThanOrEqual(200);
  });
});

describe("note_experience —— 边玩边记", () => {
  test("成败记进熟练度，教训记进档案", async () => {
    const { server, memory } = setup();
    const r = await server.call("note_experience", {
      area: "mining",
      outcome: "fail",
      lesson: "y=-59 挖了半天没钻石，这个存档钻石好像很少",
    });
    expect(r.isError).toBeFalsy();
    expect(textOf(r)).toContain("记一次失败");
    expect(textOf(r)).toContain("记住");

    const p = memory.profile();
    expect(p.adaptation.find((a) => a.area === "mining")).toMatchObject({ attempts: 1, successes: 0 });
    expect(p.lessons[0]!.text).toContain("钻石");
  });

  test("只记教训（不给成败）也行", async () => {
    const { server, memory } = setup();
    const r = await server.call("note_experience", { area: "preference", lesson: "他喜欢挖矿，不喜欢下矿洞" });
    expect(r.isError).toBeFalsy();
    expect(memory.profile().lessons.length).toBe(1);
    expect(memory.profile().adaptation.length).toBe(0);
  });

  test("什么都没给就直接说不记 —— 别让它以为记上了", async () => {
    const { server, memory } = setup();
    const r = await server.call("note_experience", { area: "mining" });
    expect(r.isError).toBe(true);
    expect(memory.profile().lessons.length).toBe(0);
  });

  test("非本事区（preference/lesson）不会被算进熟练度", async () => {
    const { server, memory } = setup();
    await server.call("note_experience", { area: "preference", outcome: "success" });
    expect(memory.profile().adaptation.length).toBe(0);
  });
});

describe("itto://profile/current 资源", () => {
  test("能读到习惯、熟练度和照着提示词的那段摘要", async () => {
    const { server, memory } = setup();
    await server.call("note_experience", { area: "combat", outcome: "success", lesson: "苦力怕要隔着打" });
    const read = server.resources.get("itto://profile/current")!;
    const body = JSON.parse((await read(new URL("itto://profile/current"))).contents[0]!.text!);
    expect(body.adaptation.find((a: { area: string }) => a.area === "combat").successes).toBe(1);
    expect(body.digest).toContain("苦力怕要隔着打");
  });
});
