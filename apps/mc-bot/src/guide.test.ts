import { describe, expect, test } from "bun:test";
import type { GameState } from "@itto/shared";
import { STAGES, guideBriefing, guideProgress, guideStatus } from "@itto/shared";

function state(inv: Array<[string, number]> = [], dimension = "overworld"): GameState {
  return {
    self: { dimension, health: 20, food: 20, heldItem: null, followState: "IDLE" },
    player: { username: "eason", pos: null, distance: 3, online: true },
    nearbyHostiles: [],
    inventory: inv.map(([name, count]) => ({ name, count })),
    recentChat: [],
    currentGoal: null,
  } as unknown as GameState;
}

describe("guideProgress", () => {
  test("a fresh world starts at step 1 (go punch a tree)", () => {
    const p = guideProgress(state());
    expect(p.index).toBe(0);
    expect(p.stage.id).toBe("wood");
    expect(p.doneCount).toBe(0);
  });

  test("logs move it to the workbench step", () => {
    const p = guideProgress(state([["oak_log", 4]]));
    expect(p.stage.id).toBe("bench");
  });

  test("a stone pickaxe + furnace counts as stone age", () => {
    expect(guideProgress(state([["oak_log", 4], ["crafting_table", 1], ["stone_pickaxe", 1], ["furnace", 1]])).stage.id).toBe("light");
  });

  test("iron gear advances it", () => {
    const p = guideProgress(state([
      ["oak_log", 4], ["crafting_table", 1], ["stone_pickaxe", 1], ["furnace", 1],
      ["torch", 12], ["iron_pickaxe", 1],
    ]));
    expect(p.stage.id).toBe("diamond");
  });

  test("being in the nether counts as past the portal step", () => {
    const inv: Array<[string, number]> = [
      ["oak_log", 4], ["crafting_table", 1], ["stone_pickaxe", 1], ["furnace", 1],
      ["torch", 12], ["iron_pickaxe", 1], ["diamond_pickaxe", 1],
    ];
    expect(guideProgress(state(inv, "the_nether")).stage.id).toBe("fortress");
  });

  test("the end means the dragon step", () => {
    const inv: Array<[string, number]> = [
      ["oak_log", 4], ["crafting_table", 1], ["stone_pickaxe", 1], ["furnace", 1],
      ["torch", 12], ["iron_pickaxe", 1], ["diamond", 3], ["obsidian", 10],
      ["blaze_rod", 6], ["ender_eye", 12],
    ];
    expect(guideProgress(state(inv, "the_end")).stage.id).toBe("dragon");
  });

  test("做到后面了就不会因为背包暂时没木头而退回'去撸树'", () => {
    // 后期背包：钻石镐 + 黑曜石 + 火把，但没带原木/工作台
    const p = guideProgress(state([["diamond_pickaxe", 1], ["obsidian", 10], ["torch", 20]]));
    expect(p.stage.id).not.toBe("wood");
    expect(p.stage.id).not.toBe("bench");
    expect(p.index).toBeGreaterThanOrEqual(6); // 至少走到"下界之门"之后
  });

  test("every stage has a hint and an action list (no half-written steps)", () => {
    for (const stage of STAGES) {
      expect(stage.hint.length).toBeGreaterThan(4);
      expect(stage.actions.length).toBeGreaterThan(4);
    }
  });
});

describe("guideStatus / guideBriefing", () => {
  test("#guide text names the current step and the next one", () => {
    const text = guideStatus(state([["oak_log", 4]]));
    expect(text).toContain("工作台");
    expect(text).toContain("1/10"); // 木头那步已经过了
    expect(text).toContain("下一步");
  });

  test("the briefing tells the brain where he is and how to help", () => {
    const text = guideBriefing(state([["oak_log", 4]]));
    expect(text).toContain("向导模式");
    expect(text).toContain("工作台");
    expect(text).toContain("craft_item");
    expect(text).toContain("不是教官");
  });
});
