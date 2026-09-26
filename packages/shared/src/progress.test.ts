import { describe, expect, test } from "bun:test";
import type { GameState } from "./types.js";
import { assessFacilities, progressBriefing, readyFacilities } from "./progress.js";

function state(pairs: Array<[string, number]>): GameState {
  return {
    inventory: pairs.map(([name, count]) => ({ name, count })),
    self: { dimension: "overworld" },
    players: ["eason"],
  } as unknown as GameState;
}

const byId = (s: GameState, id: string) => assessFacilities(s).find((f) => f.id === id)!;

describe("assessFacilities — 现在能盖什么", () => {
  test("空手开局：一个都开不了工，而且差什么都写清楚", () => {
    const all = assessFacilities(state([]));
    expect(all.length).toBeGreaterThanOrEqual(6);
    expect(all.every((f) => !f.ready)).toBe(true);
    // 小麦农场差：锄头 1、种子 3、泥土 8
    expect(byId(state([]), "wheat_farm").missing).toEqual(["锄头 ×1", "种子 ×3", "泥土/草方块 ×8"]);
  });

  test("锄头 + 种子 + 泥土 齐了 → 小麦农场可以开工", () => {
    const s = state([["wooden_hoe", 1], ["wheat_seeds", 5], ["dirt", 10]]);
    const farm = byId(s, "wheat_farm");
    expect(farm.ready).toBe(true);
    expect(farm.missing).toEqual([]);
    expect(farm.hint).toContain("锄头"); // 起手提示要给出来
  });

  test("差一点的时候只报差多少，不重复报已有的", () => {
    const s = state([["cobblestone", 24], ["torch", 8], ["stone_sword", 1]]);
    const tower = byId(s, "mob_tower");
    expect(tower.ready).toBe(false);
    expect(tower.missing).toEqual(["圆石/石头 ×40"]); // 64-24
  });

  test("中期背包：刷怪塔 / 传送门 同时可开工", () => {
    const s = state([
      ["cobblestone", 80],
      ["torch", 12],
      ["iron_sword", 1],
      ["obsidian", 10],
      ["flint_and_steel", 1],
    ]);
    const ids = readyFacilities(s).map((f) => f.id);
    expect(ids).toContain("mob_tower");
    expect(ids).toContain("portal");
  });

  test("后期背包：附魔台和铁傀儡农场也进列表", () => {
    const s = state([
      ["diamond", 6],
      ["obsidian", 12],
      ["book", 3],
      ["iron_block", 4],
      ["iron_ingot", 12],
    ]);
    const ids = readyFacilities(s).map((f) => f.id);
    expect(ids).toContain("enchant_table");
    expect(ids).toContain("iron_farm");
  });

  test("认多种同类东西（熔炉/烟熏炉/高炉都算）", () => {
    const s = state([["smoker", 1], ["blast_furnace", 1], ["chest", 2], ["cobblestone", 40], ["torch", 4]]);
    expect(byId(s, "storage_base").ready).toBe(true);
  });
});

describe("progressBriefing — 喂给大脑的那段话", () => {
  test("带上主线进度和现在能开工的工程", () => {
    const s = state([["wooden_hoe", 1], ["wheat_seeds", 5], ["dirt", 10], ["oak_log", 8]]);
    const text = progressBriefing(s);
    expect(text).toContain("【进度】");
    expect(text).toContain("小麦农场");
    expect(text).toContain("食物能自给"); // 每条工程都说清"为什么值得盖"
  });

  test("没条件的时候不硬凑，直说先跟主线走", () => {
    const text = progressBriefing(state([]));
    expect(text).toContain("【进度】");
    expect(text).toContain("先跟着主线走");
    // 空手开局不该冒出"铁傀儡农场差铁块"这种误导（它还缺村民，背包里看不见）
    expect(text).not.toContain("铁傀儡农场");
  });

  test("只差一件的时候才会进'差一点'列表", () => {
    const text = progressBriefing(state([["cobblestone", 64], ["iron_sword", 1]]));
    expect(text).toContain("差一点");
    expect(text).toContain("刷怪塔");
    expect(text).toContain("火把 ×8");
  });

  test("语气必须是建议，不是任务清单", () => {
    const text = progressBriefing(state([["wooden_hoe", 1], ["wheat_seeds", 9], ["dirt", 20]]));
    expect(text).toContain("建议");
    expect(text).toContain("别");
  });
});
