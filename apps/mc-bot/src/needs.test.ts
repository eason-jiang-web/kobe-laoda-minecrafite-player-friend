import { describe, expect, test } from "bun:test";
import type { GameState, InventoryItem } from "@itto/shared";
import {
  assessNeeds,
  canMine,
  needForOre,
  needsSummary,
  oreValue,
  pickaxeTier,
  requiredTier,
  tierName,
} from "@itto/shared";

const inv = (pairs: Array<[string, number]>): InventoryItem[] =>
  pairs.map(([name, count]) => ({ name, count }));

function state(pairs: Array<[string, number]>, players = ["eason"]): GameState {
  return { inventory: inv(pairs), players } as unknown as GameState;
}

describe("tool tiers — 能不能挖", () => {
  test("reads the best pickaxe in the bag", () => {
    expect(pickaxeTier(inv([]))).toBe(0);
    expect(pickaxeTier(inv([["stone_pickaxe", 1], ["iron_pickaxe", 1]]))).toBe(3);
    expect(pickaxeTier(inv([["netherite_pickaxe", 1]]))).toBe(5);
  });

  test("knows what each ore demands", () => {
    expect(requiredTier("diamond_ore")).toBe(3);
    expect(requiredTier("deepslate_iron_ore")).toBe(2);
    expect(requiredTier("ancient_debris")).toBe(4);
    expect(requiredTier("oak_log")).toBeNull();
  });

  test("a stone pickaxe cannot take diamonds (and says why)", () => {
    const verdict = canMine(inv([["stone_pickaxe", 1]]), "diamond_ore");
    expect(verdict.can).toBe(false);
    expect(verdict.why).toContain("铁镐");
    expect(verdict.why).toContain("石镐");
  });

  test("an iron pickaxe can", () => {
    expect(canMine(inv([["iron_pickaxe", 1]]), "diamond_ore").can).toBe(true);
  });

  test("logs never need a pickaxe", () => {
    expect(canMine(inv([]), "oak_log").can).toBe(true);
  });

  test("tier names are human readable", () => {
    expect(tierName(3)).toBe("铁镐");
  });
});

describe("ore value", () => {
  test("diamonds outrank iron, coal is not worth stopping for", () => {
    expect(oreValue("diamond_ore")).toBeGreaterThan(oreValue("iron_ore"));
    expect(oreValue("coal_ore")).toBeLessThan(3);
    expect(oreValue("ancient_debris")).toBe(10);
  });
});

describe("needs — 够了就别挖（按人数缩放）", () => {
  test("solo: 400 iron is way past the 100-per-player line", () => {
    const s = state([["raw_iron", 400], ["iron_ingot", 12]]);
    const iron = assessNeeds(s).find((l) => l.id === "iron")!;
    expect(iron.want).toBe(100);
    expect(iron.have).toBe(412);
    expect(iron.surplus).toBe(true);
    expect(iron.needed).toBe(false);
    expect(needsSummary(s)).toContain("早就够了");
  });

  test("four players: the same 400 iron is just right, not surplus", () => {
    const s = state([["raw_iron", 400]], ["eason", "steve", "alex", "notch"]);
    const iron = assessNeeds(s).find((l) => l.id === "iron")!;
    expect(iron.want).toBe(400); // 100 × 4
    expect(iron.surplus).toBe(false);
    expect(iron.needed).toBe(false);
    expect(needsSummary(s)).toContain("按 4 人算");
  });

  test("100 diamonds: surplus solo, still short with two players", () => {
    const solo = state([["diamond", 100]], ["eason"]);
    const soloDia = assessNeeds(solo).find((l) => l.id === "diamond")!;
    expect(soloDia.want).toBe(64);
    expect(soloDia.surplus).toBe(true);

    const duo = state([["diamond", 100]], ["eason", "steve"]);
    const duoDia = assessNeeds(duo).find((l) => l.id === "diamond")!;
    expect(duoDia.want).toBe(128);
    expect(duoDia.surplus).toBe(false);
    expect(duoDia.needed).toBe(true);
  });

  test("netherite is tracked too (scrap and debris both count)", () => {
    const s = state([["ancient_debris", 4], ["netherite_scrap", 2]]);
    const netherite = assessNeeds(s).find((l) => l.id === "netherite")!;
    expect(netherite.have).toBe(6);
    expect(netherite.want).toBe(32);
    expect(netherite.needed).toBe(true);
  });

  test("a fresh world needs wood and stone", () => {
    const summary = needsSummary(state([]));
    expect(summary).toContain("木头");
    expect(summary).toContain("还缺");
  });

  test("an ore maps to the need it would satisfy", () => {
    const s = state([["raw_iron", 400]]);
    const ironOre = needForOre(s, "deepslate_iron_ore")!;
    expect(ironOre.id).toBe("iron");
    expect(ironOre.surplus).toBe(true);
    expect(needForOre(s, "diamond_ore")?.id).toBe("diamond");
    expect(needForOre(s, "ancient_debris")?.id).toBe("netherite");
    expect(needForOre(s, "oak_log")).toBeNull();
  });
});
