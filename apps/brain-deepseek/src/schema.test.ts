import { describe, expect, test } from "bun:test";
import { normalizeSchema } from "./schema.js";
import { formatHistory, openerWarning, type HistoryEntry } from "./history.js";

describe("normalizeSchema", () => {
  test("strips $schema and forces an object root", () => {
    const out = normalizeSchema({ $schema: "http://json-schema.org/draft-07/schema#", type: "object", properties: {} });
    expect(out.$schema).toBeUndefined();
    expect(out.type).toBe("object");
  });

  test("garbage in, usable object schema out", () => {
    expect(normalizeSchema(undefined)).toEqual({ type: "object", properties: {} });
    expect(normalizeSchema("nope")).toEqual({ type: "object", properties: {} });
  });

  test("inlines $ref against definitions", () => {
    const out = normalizeSchema({
      type: "object",
      properties: { target: { $ref: "#/definitions/Vec3" } },
      definitions: { Vec3: { type: "object", properties: { x: { type: "number" } }, required: ["x"] } },
    });
    expect(out.definitions).toBeUndefined();
    const props = out.properties as Record<string, Record<string, unknown>>;
    expect(props.target?.type).toBe("object");
    expect((props.target?.properties as Record<string, unknown>).x).toEqual({ type: "number" });
  });

  test("drops null out of union types", () => {
    const out = normalizeSchema({ type: "object", properties: { n: { type: ["string", "null"] } } });
    const props = out.properties as Record<string, Record<string, unknown>>;
    expect(props.n?.type).toBe("string");
  });

  test("keeps real unions as anyOf", () => {
    const out = normalizeSchema({ type: "object", properties: { n: { type: ["string", "number"] } } });
    const props = out.properties as Record<string, Record<string, unknown>>;
    expect(props.n?.type).toBeUndefined();
    expect(props.n?.anyOf).toEqual([{ type: "string" }, { type: "number" }]);
  });
});

describe("formatHistory", () => {
  test("renders recent turns compactly", () => {
    const entries: HistoryEntry[] = [
      { at: 1_000, reason: 'eason said "itto"', said: "yo", did: ["chat"] },
      { at: 2_000, reason: "heartbeat", said: "", did: [] },
    ];
    const out = formatHistory(entries, 61_000);
    expect(out).toContain('eason said "itto"');
    expect(out).toContain('说了 "yo" [chat]');
    expect(out).toContain("没说话");
  });

  test("说出去的话 和 心里想的话 要分得清 —— 这是防复读的前提", () => {
    // 真实踩过的：它每轮都写一句「砍树任务还在跑，不吭声了。」当收尾，
    // 那句话根本没发到游戏里，却被记成"说过了"，下一轮它照着又写一遍。
    const entries: HistoryEntry[] = [
      { at: 1_000, reason: "heartbeat", said: "树砍完了，128 个木头", did: ["chat"] },
      { at: 2_000, reason: "heartbeat", said: "", note: "砍树任务还在跑，不吭声了。", did: ["read_resource"] },
    ];
    const out = formatHistory(entries, 61_000);
    expect(out).toContain('说了 "树砍完了，128 个木头"');
    expect(out).toContain("没说话");
    expect(out).toContain("心里想：砍树任务还在跑");
    // 独白不能冒充成"说过了"
    expect(out).not.toContain('说了 "砍树任务还在跑');
  });

  test("开场白连着用三次，就当面点破 —— 光列出来反而会强化这个习惯", () => {
    const entries: HistoryEntry[] = [
      { at: 1_000, reason: "x", said: "收到 man，木头凑到 8 根了", did: ["chat"] },
      { at: 2_000, reason: "x", said: "收到 man，东北那两棵树我包了", did: ["chat"] },
      { at: 3_000, reason: "x", said: "收到 man，石头这就去刨", did: ["chat"] },
    ];
    const out = formatHistory(entries, 4_000);
    expect(out).toContain("⚠️");
    expect(out).toContain("换个开场白");
    expect(openerWarning(entries)).toContain("3 句");
  });

  test("各说各的就不啰嗦", () => {
    const entries: HistoryEntry[] = [
      { at: 1_000, reason: "x", said: "东北边有棵树", did: ["chat"] },
      { at: 2_000, reason: "x", said: "天黑了先回基地", did: ["chat"] },
      { at: 3_000, reason: "x", said: "我这就去下矿", did: ["chat"] },
    ];
    expect(formatHistory(entries, 4_000)).not.toContain("⚠️");
  });

  test("多句用 ｜ 连起来，一眼看得出这轮说了几句", () => {
    const entries: HistoryEntry[] = [
      { at: 1_000, reason: "x", said: "来了 man ｜ 这就开挖", did: ["chat", "chat"] },
    ];
    expect(formatHistory(entries, 2_000)).toContain("来了 man ｜ 这就开挖");
  });
});
