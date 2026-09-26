import { describe, expect, test } from "bun:test";
import type { GameState } from "@itto/shared";
import {
  evaluateInventory,
  evaluateItem,
  itemKnowledge,
  valueReport,
} from "@itto/shared";

function state(pairs: Array<[string, number]>, players = ["eason"]): GameState {
  return {
    inventory: pairs.map(([name, count]) => ({ name, count })),
    players,
  } as unknown as GameState;
}

describe("itemKnowledge — 认识的东西", () => {
  test("netherite and elytra sit at the top", () => {
    expect(itemKnowledge("netherite_ingot").tier).toBe("relic");
    expect(itemKnowledge("elytra").base).toBeGreaterThanOrEqual(90);
  });

  test("dirt is bulk, leaves are chaff", () => {
    expect(itemKnowledge("dirt").tier).toBe("bulk");
    expect(itemKnowledge("oak_leaves").tier).toBe("chaff");
    expect(itemKnowledge("dirt").capPerPlayer).toBe(0);
  });

  test("iron is useful because its uses are so wide", () => {
    expect(itemKnowledge("iron_ingot").tier).toBe("useful");
    expect(itemKnowledge("iron_ingot").use).toContain("铁砧");
  });

  test("unknown items still get an estimate from their name", () => {
    expect(itemKnowledge("weird_new_ore").tier).toBe("precious");
    expect(itemKnowledge("weird_new_ingot").tier).toBe("useful");
    expect(itemKnowledge("weird_new_log").tier).toBe("common");
    expect(itemKnowledge("mystery_thing").use).toContain("不太确定");
  });
});

describe("evaluateItem — 按当下情况判断", () => {
  test("a fresh player: diamonds are worth grabbing", () => {
    const v = evaluateItem("diamond", 2, state([["diamond", 2]]));
    expect(v.verdict).toBe("worth");
    expect(v.advice).toContain("值得");
  });

  test("past the cap: it stops being worth anything", () => {
    const v = evaluateItem("diamond", 300, state([["diamond", 300]]));
    expect(v.verdict).toBe("overflow");
    expect(v.score).toBeLessThan(itemKnowledge("diamond").base); // 价值分被压下去了
    expect(v.advice).toContain("占地方");
  });

  test("strictly between: enough, but don't make a trip for it", () => {
    const v = evaluateItem("diamond", 64, state([["diamond", 64]]));
    expect(v.verdict).toBe("enough");
    expect(v.advice).toContain("不用特意");
  });

  test("bulk materials never ask for a detour", () => {
    expect(evaluateItem("dirt", 9999, state([["dirt", 9999]])).verdict).toBe("unlimited");
  });

  test("the cap scales with online players", () => {
    const solo = evaluateItem("diamond", 100, state([["diamond", 100]]));
    const duo = evaluateItem("diamond", 100, state([["diamond", 100]], ["eason", "steve"]));
    expect(solo.verdict).toBe("overflow"); // 上限 64
    expect(duo.verdict).toBe("worth"); // 上限 128 —— 两个人就不算多，还值得顺手拿
  });
});

describe("valueReport — 语气必须是建议，不是任务", () => {
  test("it never nags: the closing line says so", () => {
    const text = valueReport(state([["diamond", 5], ["dirt", 400]]));
    expect(text).toContain("不是任务清单");
    expect(text).toContain("他不想弄就别提");
  });

  test("worth items come with the reason they matter", () => {
    const text = valueReport(state([["diamond", 5]]));
    expect(text).toContain("当下还算值钱");
    expect(text).toContain("附魔台");
  });

  test("overflow is reported so it stops being suggested", () => {
    const text = valueReport(state([["raw_iron", 400]]));
    expect(text).toContain("溢出的");
    expect(text).toContain("别催他囤");
  });

  test("an empty bag is fine", () => {
    expect(valueReport(state([]))).toContain("空");
  });

  test("the whole inventory is evaluated, not just a hardcoded few", () => {
    const inv = evaluateInventory(state([["diamond", 5], ["dirt", 10], ["weird_new_ore", 1], ["oak_log", 3]]));
    expect(inv.length).toBe(4);
    expect(inv[0]!.name).toBe("diamond"); // 排最前
    expect(inv.map((v) => v.name)).toContain("weird_new_ore");
  });
});
