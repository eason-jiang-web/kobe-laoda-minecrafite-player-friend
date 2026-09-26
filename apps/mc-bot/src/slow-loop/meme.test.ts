import { describe, expect, test } from "bun:test";
import type { GameState } from "@itto/shared";
import { classifySituation, rollMeme } from "./meme.js";

function state(over: {
  health?: number;
  hostiles?: Array<{ id: number; name: string; distance: number }>;
  playerDistance?: number | null;
}): GameState {
  return {
    self: { health: over.health ?? 20 },
    player: over.playerDistance === null ? null : { username: "eason", distance: over.playerDistance ?? 20, online: true },
    nearbyHostiles: (over.hostiles ?? []).map((h) => ({
      ...h,
      pos: { x: 0, y: 64, z: 0 },
    })),
  } as unknown as GameState;
}

const zombie = { id: 1, name: "zombie", distance: 4 };
const always = () => 0; // lowest possible roll
const never = () => 0.99; // highest possible roll

describe("classifySituation", () => {
  test("low health or being swarmed is 绝境", () => {
    expect(classifySituation(state({ health: 5 }), "heartbeat")).toBe("desperate");
    expect(
      classifySituation(state({ health: 10, hostiles: [zombie, { id: 2, name: "zombie", distance: 5 }, { id: 3, name: "skeleton", distance: 6 }] }), "heartbeat"),
    ).toBe("desperate");
  });

  test("a mob next to the player is 兄弟挨打, not just a fight", () => {
    expect(classifySituation(state({ hostiles: [zombie], playerDistance: 3 }), "heartbeat")).toBe("brother-hurt");
    expect(classifySituation(state({ hostiles: [zombie], playerDistance: 18 }), "heartbeat")).toBe("combat");
  });

  test("quiet moments are idle, and unrelated events get no meme at all", () => {
    expect(classifySituation(state({}), 'player said: "牢大 过来"')).toBe("idle");
    expect(classifySituation(state({}), "库存里程碑：木头攒到 128")).toBeNull();
  });
});

describe("rollMeme — the card's odds", () => {
  test("绝境 is 100% and forced", () => {
    const roll = rollMeme(state({ health: 4 }), "heartbeat", never);
    expect(roll?.situation).toBe("desperate");
    expect(roll?.forced).toBe(true);
  });

  test("打架 is 30%: 0.1 fires, 0.5 does not", () => {
    const fight = state({ hostiles: [zombie], playerDistance: 20 });
    expect(rollMeme(fight, "heartbeat", () => 0.1)).not.toBeNull();
    expect(rollMeme(fight, "heartbeat", () => 0.5)).toBeNull();
  });

  test("兄弟挨打 is 50%: 0.4 fires, 0.7 does not", () => {
    const hurt = state({ hostiles: [zombie], playerDistance: 3 });
    expect(rollMeme(hurt, "heartbeat", () => 0.4)).not.toBeNull();
    expect(rollMeme(hurt, "heartbeat", () => 0.7)).toBeNull();
  });

  test("闲聊 is 10%: 0.05 fires, 0.2 does not", () => {
    const calm = state({});
    expect(rollMeme(calm, "heartbeat", () => 0.05)).not.toBeNull();
    expect(rollMeme(calm, "heartbeat", () => 0.2)).toBeNull();
  });

  test("a bad roll in 绝境 still fires (always 100%)", () => {
    expect(rollMeme(state({ health: 3 }), "heartbeat", never)).not.toBeNull();
  });

  test("no situation, no meme", () => {
    expect(rollMeme(state({}), "库存里程碑：木头攒到 128", always)).toBeNull();
  });
});
