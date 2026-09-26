import { describe, expect, test } from "bun:test";
import {
  askHint,
  askKey,
  decideAsk,
  DEFAULT_ASK_POLICY,
  pruneAsks,
  recordAsk,
  type AskRecord,
} from "./ask-budget.js";

const T0 = 1_700_000_000_000;
const MIN = 60_000;

describe("askKey —— 同一个话题要落到同一个键", () => {
  test("空格、标点、大小写都不影响", () => {
    expect(askKey("去哪个 地方", "x")).toBe(askKey("去哪个地方。", "y"));
    expect(askKey("Where To Go", "x")).toBe(askKey("where to go", "y"));
  });

  test("没给 topic 就用问题本身兜底", () => {
    expect(askKey(undefined, "去哪个地方")).toBe(askKey("", "去哪个地方"));
    expect(askKey("   ", "去哪个地方")).toBe(askKey(undefined, "去哪个地方"));
  });

  test("空得没法用时给个固定键，不是空串", () => {
    expect(askKey(undefined, "  ").length).toBeGreaterThan(0);
  });
});

describe("decideAsk —— 同一件事最多问三次", () => {
  test("前三次放行，剩余额度递减", () => {
    const first = decideAsk([], "k", "去哪", T0);
    expect(first.allowed).toBe(true);
    expect(first.count).toBe(1);
    expect(first.remaining).toBe(2);

    let recs: AskRecord[] = [];
    for (let i = 1; i <= 3; i++) {
      const v = decideAsk(recs, "k", "去哪", T0 + i);
      expect(v.allowed).toBe(true);
      expect(v.count).toBe(i);
      recs = recordAsk(recs, "k", "去哪", T0 + i);
    }
    expect(decideAsk(recs, "k", "去哪", T0 + 4).remaining).toBe(0);
  });

  test("第四次拒绝，而且要说清楚「这条没发出去」+ 下一步干嘛", () => {
    let recs: AskRecord[] = [];
    for (let i = 0; i < 3; i++) recs = recordAsk(recs, "k", "去哪个地方", T0 + i);
    const v = decideAsk(recs, "k", "去哪个地方", T0 + 5);
    expect(v.allowed).toBe(false);
    expect(v.why).toContain("问过 3 次");
    expect(v.why).toContain("没发出去");
    expect(v.why).toContain("直接开工");
    expect(v.why).toContain("去哪个地方"); // 带上原话，模型才知道是哪件事
  });

  test("不同话题各算各的额度", () => {
    let recs: AskRecord[] = [];
    for (let i = 0; i < 3; i++) recs = recordAsk(recs, "aaa", "问 A", T0 + i);
    expect(decideAsk(recs, "aaa", "问 A", T0 + 4).allowed).toBe(false);
    expect(decideAsk(recs, "bbb", "问 B", T0 + 4).allowed).toBe(true);
  });

  test("时间窗过了额度自动重置（换个时间还能正常问）", () => {
    let recs: AskRecord[] = [];
    for (let i = 0; i < 3; i++) recs = recordAsk(recs, "k", "去哪", T0 + i);
    const later = T0 + DEFAULT_ASK_POLICY.windowMs + 10; // 三条记录时间戳只差几毫秒，多给一点
    expect(decideAsk(recs, "k", "去哪", later).allowed).toBe(true);
    // 而且计数从头开始，不是接着 3 往上加
    const again = recordAsk(recs, "k", "去哪", later);
    expect(again.find((r) => r.key === "k")?.count).toBe(1);
  });

  test("换个说法接着问也拦得住（窗口内总量上限）", () => {
    let recs: AskRecord[] = [];
    // maxPerWindow=5：连着问 5 个不同话题，第 6 个必须被拦
    for (let i = 0; i < 5; i++) recs = recordAsk(recs, "t" + i, "话题" + i, T0 + i);
    const v = decideAsk(recs, "t9", "换个说法的同一件事", T0 + 6);
    expect(v.allowed).toBe(false);
    expect(v.why).toContain("太密");
  });
});

describe("pruneAsks / askHint", () => {
  test("过期记录直接丢掉", () => {
    const recs = recordAsk([], "k", "去哪", T0);
    expect(pruneAsks(recs, T0 + 1000).length).toBe(1);
    expect(pruneAsks(recs, T0 + DEFAULT_ASK_POLICY.windowMs + 1).length).toBe(0);
  });

  test("没有问满的话题就不啰嗦", () => {
    const recs = recordAsk([], "k", "去哪", T0);
    expect(askHint(recs, T0 + 1)).toBeNull();
    expect(askHint([], T0)).toBeNull();
  });

  test("问满的话题会写进唤醒提示，让模型开口之前就知道别再问", () => {
    let recs: AskRecord[] = [];
    for (let i = 0; i < 3; i++) recs = recordAsk(recs, "k", "去哪个地方", T0 + i);
    const hint = askHint(recs, T0 + 10);
    expect(hint).not.toBeNull();
    expect(hint).toContain("去哪个地方");
    expect(hint).toContain("别再问");
    expect(hint).toContain("最合理的假设");
  });
});
