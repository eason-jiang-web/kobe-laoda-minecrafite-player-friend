import { test, expect } from "bun:test";
import type { GameState } from "@itto/shared";
import { createTriggers } from "./triggers.js";

// The character is 牢大 / Laoda; the wake words are what the player types.
const TRIGGERS = createTriggers({
  botUsername: "Laoda",
  wakeWords: ["Laoda", "牢大", "曼巴", "itto"],
});

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
    player: { username: "eason", pos: { x: 0, y: 64, z: 0 }, distance: 2, online: true },
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

// Same bot, but in "answer everything the owner says" mode.
const CHATTY = createTriggers({
  botUsername: "Laoda",
  wakeWords: ["Laoda", "牢大", "曼巴"],
  replyToAll: true,
});
const fireChatty = (s: GameState) =>
  CHATTY.find((t) => t.name === "player_addressed_bot")!.check(s, null);

test("chat is a priority trigger (it cuts the slow loop's rate limit)", () => {
  const addressed = TRIGGERS.find((t) => t.name === "player_addressed_bot")!;
  expect(addressed.priority).toBe(true);
  expect(TRIGGERS.find((t) => t.name === "incoming_threat")!.priority).toBeUndefined();
});

test("replyToAll answers the owner even without a wake word", () => {
  const s = makeState({ recentChat: [{ username: "eason", message: "这矿洞真深啊", at: Date.now() }] });
  expect(fireChatty(s)).toContain("这矿洞真深啊");

  // ...but stays out of other players' conversation
  const other = makeState({ recentChat: [{ username: "steve", message: "这矿洞真深啊", at: Date.now() }] });
  expect(fireChatty(other)).toBeNull();
});

test("replyToAll still ignores the bot's own chat", () => {
  const s = makeState({ recentChat: [{ username: "Laoda", message: "man, what can I say", at: Date.now() }] });
  expect(fireChatty(s)).toBeNull();
});

test("player_addressed_bot fires on the character's name", () => {
  const s = makeState({ recentChat: [{ username: "eason", message: "牢大 过来", at: Date.now() }] });
  expect(fire("player_addressed_bot", s, null)).toContain("牢大");
});

test("player_addressed_bot fires on the in-game username, any casing", () => {
  const s = makeState({ recentChat: [{ username: "eason", message: "laoda come here", at: Date.now() }] });
  expect(fire("player_addressed_bot", s, null)).toBeTruthy();
});

test("player_addressed_bot fires on a wake word", () => {
  const s = makeState({ recentChat: [{ username: "eason", message: "曼巴？", at: Date.now() }] });
  expect(fire("player_addressed_bot", s, null)).toBeTruthy();
});

test("player_addressed_bot ignores the bot's own messages", () => {
  const s = makeState({ recentChat: [{ username: "Laoda", message: "Laoda 在这", at: Date.now() }] });
  expect(fire("player_addressed_bot", s, null)).toBeNull();
});

test("player_addressed_bot ignores unrelated chatter", () => {
  const s = makeState({ recentChat: [{ username: "eason", message: "这矿洞真大", at: Date.now() }] });
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
