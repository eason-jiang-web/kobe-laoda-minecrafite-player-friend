import { describe, expect, test } from "bun:test";
import type { GameState, InventoryItem } from "@itto/shared";
import { canMine, needForOre } from "@itto/shared";
import { buildAutoplayReason, oreReason, shouldHeartbeat, type MemoryDigestSource } from "./index.js";

const state = {
  self: { health: 20, food: 18, heldItem: "iron_axe", followState: "IDLE" },
  player: { username: "eason", distance: 4, online: true },
  nearbyHostiles: [],
  inventory: [
    { name: "oak_log", count: 64 },
    { name: "cobblestone", count: 128 },
  ],
  recentChat: [],
  currentGoal: null,
} as unknown as GameState;

function memory(notes: string[], places: Array<[string, number, number, number]>): MemoryDigestSource {
  return {
    recentNotes: (limit = 3) => notes.slice(0, limit).map((text) => ({ text })),
    recallLocations: (filter) =>
      places.slice(0, filter?.limit ?? 4).map(([name, x, y, z]) => ({ name, pos: { x, y, z } })),
  };
}

const inv = (pairs: Array<[string, number]>): InventoryItem[] => pairs.map(([name, count]) => ({ name, count }));
const ore = { name: "diamond_ore", pos: { x: 12, y: -54, z: 30 }, distance: 7 };

describe("shouldHeartbeat — 什么时候该叫醒它", () => {
  test("任务正在跑：不叫（这句话刷过屏）", () => {
    // 实测：任务在跑时每 45 秒叫一次，它只能回「砍树任务还在跑，不吭声了。」
    expect(shouldHeartbeat({ quiet: false, guide: false, idle: false })).toBe(false);
  });

  test("闲着没事：叫，让它自己找活干", () => {
    expect(shouldHeartbeat({ quiet: false, guide: false, idle: true })).toBe(true);
  });

  test("#quiet 闭嘴模式：一律不叫", () => {
    expect(shouldHeartbeat({ quiet: true, guide: false, idle: true })).toBe(false);
    expect(shouldHeartbeat({ quiet: true, guide: true, idle: false })).toBe(false);
  });

  test("向导模式：即使手上有任务也叫（提示下一步是这个模式的本职）", () => {
    expect(shouldHeartbeat({ quiet: false, guide: true, idle: false })).toBe(true);
  });
});

describe("oreReason — 路过一块矿的三条路", () => {
  test("can't mine it: remember the spot and say so", () => {
    const text = oreReason(ore, canMine(inv([["stone_pickaxe", 1]]), ore.name), null);
    expect(text).toContain("挖不动");
    expect(text).toContain("remember_location");
    expect(text).toContain("先记着");
  });

  test("already swimming in it: mark and move on, don't waste the trip", () => {
    // 个人档：钻石每人 200 才叫够，所以这里得给到 300 才触发"别绕路"
    const rich = { ...state, inventory: inv([["iron_pickaxe", 1], ["diamond", 300]]) } as unknown as GameState;
    const text = oreReason(ore, canMine(rich.inventory, ore.name), needForOre(rich, ore.name));
    expect(text).toContain("早就够用");
    expect(text).toContain("别绕路");
  });

  test("needed and mineable: grab it, then report", () => {
    const thin = { ...state, inventory: inv([["iron_pickaxe", 1]]) } as unknown as GameState;
    const text = oreReason(ore, canMine(thin.inventory, ore.name), needForOre(thin, ore.name));
    expect(text).toContain("挖得动");
    expect(text).toContain("还没到上限"); // 不催：说"还没到上限"，不说"你缺"
    expect(text).toContain("dig_at");
  });
});

describe("buildAutoplayReason", () => {
  test("carries the inventory so the choice can be sensible", () => {
    const text = buildAutoplayReason(state);
    expect(text).toContain("自由活动");
    expect(text).toContain("oak_log×64");
    expect(text).toContain("cobblestone×128");
  });

  test("surfaces what it remembers, instead of leaving it in the database", () => {
    const text = buildAutoplayReason(
      state,
      memory(["eason 想要个城堡", "还欠一趟下界"], [["基地", 120, 64, -340]]),
    );
    expect(text).toContain("eason 想要个城堡");
    expect(text).toContain("基地(120, 64, -340)");
  });

  test("stays clean when there is nothing remembered yet", () => {
    const text = buildAutoplayReason(state, memory([], []));
    expect(text).not.toContain("你记得的事");
    expect(text.split("\n").every((line) => line.trim().length > 0)).toBe(true);
  });

  test("the autoplay prompt carries the value report, phrased as advice", () => {
    const text = buildAutoplayReason({
      ...state,
      inventory: [{ name: "raw_iron", count: 400 }],
    } as unknown as GameState);
    expect(text).toContain("溢出");
    expect(text).toContain("别催他囤"); // 语气要求：不催
    expect(text).toContain("不是任务清单");
  });

  test("a broken memory store doesn't break the wake-up", () => {
    const broken = {
      recentNotes: () => {
        throw new Error("db locked");
      },
      recallLocations: () => [],
    } as unknown as MemoryDigestSource;
    expect(buildAutoplayReason(state, broken)).toContain("自由活动");
  });
});
