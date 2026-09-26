import { describe, expect, test } from "bun:test";
import type { GameState } from "@itto/shared";
import { MilestoneTracker, parseMilestones } from "./milestones.js";

function state(inventory: Array<{ name: string; count: number }>): GameState {
  return { inventory } as unknown as GameState;
}

describe("parseMilestones", () => {
  test("parses groups and concrete items", () => {
    const rules = parseMilestones("any_log:128, diamond:10");
    expect(rules.map((r) => [r.key, r.threshold, r.label])).toEqual([
      ["any_log", 128, "木头"],
      ["diamond", 10, "diamond"],
    ]);
  });

  test("ignores junk tokens instead of dying", () => {
    expect(parseMilestones("").length).toBe(0);
    expect(parseMilestones("any_log:").length).toBe(0);
    expect(parseMilestones("any_log:0").length).toBe(0);
    expect(parseMilestones("nonsense:abc").length).toBe(0);
  });
});

describe("MilestoneTracker", () => {
  test("counts every wood variant toward one milestone", () => {
    const t = new MilestoneTracker(parseMilestones("any_log:128"));
    expect(t.check(state([{ name: "oak_log", count: 100 }]))).toBeNull();
    const report = t.check(state([
      { name: "oak_log", count: 100 },
      { name: "spruce_log", count: 28 },
      { name: "cobblestone", count: 999 },
    ]));
    expect(report).toContain("128");
    expect(report).toContain("木头");
    expect(report).toContain("oak_log×100");
  });

  test("reports once, then stays quiet until the pile resets", () => {
    const t = new MilestoneTracker(parseMilestones("diamond:10"));
    const rich = state([{ name: "diamond", count: 12 }]);
    expect(t.check(rich)).toContain("diamond");
    expect(t.check(rich)).toBeNull();
    // stashed in a chest -> milestone re-arms
    expect(t.check(state([{ name: "diamond", count: 2 }]))).toBeNull();
    expect(t.check(rich)).toContain("diamond");
  });

  test("rare group aggregates different minerals with a breakdown", () => {
    const t = new MilestoneTracker(parseMilestones("rare:10"));
    const report = t.check(state([
      { name: "diamond", count: 6 },
      { name: "emerald", count: 4 },
      { name: "raw_iron", count: 300 },
    ]));
    expect(report).toContain("稀有矿物");
    expect(report).toContain("10");
    expect(report).toContain("diamond×6");
  });

  test("no rules, no noise", () => {
    const t = new MilestoneTracker(parseMilestones(""));
    expect(t.check(state([{ name: "oak_log", count: 9999 }]))).toBeNull();
  });
});
