import { test, expect } from "bun:test";
import type { GameState } from "@itto/shared";
import { TRIGGERS } from "./triggers.js";

function makeState(over: Partial<GameState> = {}): GameState {
  return {
    at: Date.now(),
    timeOfDay: 1000,
    self: {
      pos: { x: 0, y: 64, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      health: 20,
      food: 20,
      heldItem: null,
      onGround: true,
      dimension: "overworld",
    },
    player: { username: "matt", pos: { x: 0, y: 64, z: 0 }, distance: 2, online: true },
    nearbyHostiles: [],
    recentChat: [],
    inventory: [],
    followState: "IDLE",
    currentGoal: null,
    ...over,
  };
}

const fire = (name: string, s: GameState, prev: GameState | null) =>
  TRIGGERS.find((t) => t.name === name)!.check(s, prev);

test("player_addressed_bot fires when itto is named", () => {
  const s = makeState({ recentChat: [{ username: "matt", message: "yo itto come here", at: Date.now() }] });
  expect(fire("player_addressed_bot", s, null)).toContain("itto");
});

test("player_addressed_bot ignores itto's own messages", () => {
  const s = makeState({ recentChat: [{ username: "itto", message: "itto here", at: Date.now() }] });
  expect(fire("player_addressed_bot", s, null)).toBeNull();
});

test("incoming_threat only fires on a NEW hostile", () => {
  const hostile = { id: 7, name: "zombie", pos: { x: 1, y: 64, z: 1 }, distance: 5 };
  const s = makeState({ nearbyHostiles: [hostile] });
  expect(fire("incoming_threat", s, makeState())).toContain("zombie");
  // already-seen hostile should not re-fire
  expect(fire("incoming_threat", s, s)).toBeNull();
});

test("self_low_health fires once on crossing the threshold", () => {
  const low = makeState({ self: { ...makeState().self, health: 5 } });
  const ok = makeState({ self: { ...makeState().self, health: 18 } });
  expect(fire("self_low_health", low, ok)).toContain("critical");
  expect(fire("self_low_health", low, low)).toBeNull();
});

test("night_falling fires on the day→night transition", () => {
  const day = makeState({ timeOfDay: 11000 });
  const night = makeState({ timeOfDay: 13000 });
  expect(fire("night_falling", night, day)).toContain("dark");
  expect(fire("night_falling", night, night)).toBeNull();
});

test("tool_broke fires when held durability drops below 10%", () => {
  const base = makeState();
  const worn = makeState({
    self: { ...base.self, heldItem: "iron_pickaxe", heldDurability: { current: 5, max: 250 } },
  });
  const fine = makeState({
    self: { ...base.self, heldItem: "iron_pickaxe", heldDurability: { current: 200, max: 250 } },
  });
  expect(fire("tool_broke", worn, fine)).toContain("break");
  expect(fire("tool_broke", worn, worn)).toBeNull();
});
