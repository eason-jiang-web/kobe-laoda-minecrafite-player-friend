import { describe, expect, test } from "bun:test";
import type { BotControl, BotGoal, GameState } from "@itto/shared";
import { GoalRunner } from "./goal-runner.js";

/** Flush the microtask queue so a started skill/async step settles. */
const settle = () => new Promise((r) => setTimeout(r, 0));

function harness() {
  const state = {
    inventory: [] as Array<{ name: string; count: number }>,
    player: { username: "eason", pos: { x: 0, y: 64, z: 0 }, distance: 2, online: true },
    self: { pos: { x: 0, y: 64, z: 0 } },
  };
  let itemEntities: Array<{ id: number; name: string; pos: { x: number; y: number; z: number }; distance: number }> = [];
  const dropped: Array<{ name: string; count: number }> = [];
  const skills: string[] = [];
  const completed: BotGoal[] = [];

  const control = {
    getState: () => state as unknown as GameState,
    chat: async () => {},
    stop: () => {},
    moveTo: async () => {},
    dropItem: async (name: string, count = 1) => {
      dropped.push({ name, count });
      // dropping puts an item entity on the ground at his feet
      itemEntities = [{ id: 1, name: "item", pos: { x: 0, y: 64, z: 0 }, distance: 1 }];
    },
    findEntities: (names: string[]) => (names.includes("item") ? itemEntities : []),
  } as unknown as BotControl;

  const runner = new GoalRunner({
    control,
    runSkill: async (name) => {
      skills.push(name);
      return "ran " + name;
    },
    suspendFollow: () => {},
    resumeFollow: () => {},
    onComplete: (g) => completed.push(g),
  });

  return {
    runner,
    state,
    dropped,
    skills,
    completed,
    pickedUp: () => {
      itemEntities = [];
    },
  };
}

describe("collect — verified by the inventory, not by the skill returning", () => {
  test("keeps gathering until the count is really there", async () => {
    const h = harness();
    h.runner.setGoal({ kind: "collect", item: "oak_log", count: 32 }, "get 32 logs");

    h.runner.tick();
    await settle();
    expect(h.skills).toEqual(["chop_tree"]); // picked the right tool for logs
    expect(h.runner.currentGoal()?.status).toBe("active"); // NOT done just because the skill ran

    h.state.inventory = [{ name: "oak_log", count: 40 }];
    h.runner.tick();
    expect(h.runner.currentGoal()).toBeNull();
    expect(h.completed.at(-1)?.status).toBe("done");
    expect(h.completed.at(-1)?.progress).toContain("40/32");
  });

  test("does not stack gather rounds while one is running", async () => {
    const h = harness();
    h.runner.setGoal({ kind: "collect", item: "oak_log", count: 64 }, "get 64 logs");
    h.runner.tick();
    h.runner.tick();
    h.runner.tick();
    await settle();
    expect(h.skills).toEqual(["chop_tree"]); // exactly one round in flight
  });

  test("gives up honestly after MAX_ROUNDS and says how far it got", async () => {
    const h = harness();
    h.runner.setGoal({ kind: "collect", item: "diamond", count: 8 }, "get diamonds");
    for (let i = 0; i < 8; i++) {
      h.runner.tick();
      await settle();
    }
    const goal = h.completed.at(-1);
    expect(goal?.status).toBe("failed");
    expect(goal?.error).toContain("0/8");
    expect(h.skills.every((s) => s === "mine_vein")).toBe(true);
  });

  test("fails fast on something it has no way to gather", () => {
    const h = harness();
    h.runner.setGoal({ kind: "collect", item: "dirt", count: 64 }, "get dirt");
    h.runner.tick();
    expect(h.completed.at(-1)?.status).toBe("failed");
    expect(h.completed.at(-1)?.error).toContain("不知道用什么办法");
  });
});

describe("deliver — verified by him actually picking it up", () => {
  test("fails immediately when the items are not in the bag", () => {
    const h = harness();
    h.runner.setGoal({ kind: "deliver", items: [{ name: "stone_pickaxe", count: 1 }] }, "hand over pickaxe");
    h.runner.tick();
    expect(h.completed.at(-1)?.status).toBe("failed");
    expect(h.completed.at(-1)?.error).toContain("stone_pickaxe");
  });

  test("drops the stuff, then waits for the pickup before calling it done", async () => {
    const h = harness();
    h.state.inventory = [{ name: "stone_pickaxe", count: 1 }];
    h.runner.setGoal({ kind: "deliver", items: [{ name: "stone_pickaxe", count: 1 }] }, "hand over pickaxe");

    h.runner.tick();
    await settle();
    expect(h.dropped).toEqual([{ name: "stone_pickaxe", count: 1 }]);
    expect(h.runner.currentGoal()?.status).toBe("active"); // dropped ≠ delivered

    h.runner.tick(); // items still on the ground -> still not done
    expect(h.runner.currentGoal()?.status).toBe("active");

    h.pickedUp();
    h.runner.tick();
    expect(h.completed.at(-1)?.status).toBe("done");
    expect(h.completed.at(-1)?.progress).toContain("收下");
  });
});

describe("completion feedback", () => {
  test("real work reports back, trivial say/follow does not", async () => {
    const h = harness();
    h.runner.setGoal({ kind: "say", text: "yo" }, "say yo");
    h.runner.tick();
    await settle();
    expect(h.completed.length).toBe(0);

    h.runner.setGoal({ kind: "skill", name: "chop_tree" }, "chop a tree");
    h.runner.tick();
    await settle();
    expect(h.completed.length).toBe(1);
    expect(h.completed[0]?.status).toBe("done");
  });
});
