import { describe, expect, test } from "bun:test";
import type { GameState } from "@itto/shared";
import { createTriggers } from "./triggers.js";
import { clearPlayerActions, recordPlayerAction } from "../state/player-actions.js";

function state(): GameState {
  return {
    inventory: [],
    self: { health: 20, food: 20, dimension: "overworld" },
    nearbyHostiles: [],
    recentChat: [],
    players: ["eason", "Laoda"],
    timeOfDay: 3000,
  } as unknown as GameState;
}

const owner = "eason";
const triggers = createTriggers({ botUsername: "Laoda", wakeWords: ["牢大"], replyToAll: true });
const byName = (name: string) => triggers.find((t) => t.name === name)!;

describe("他做了什么 —— 触发器", () => {
  test("他被打 / 死了 → 走优先通道，理由里带下一步", () => {
    clearPlayerActions();
    recordPlayerAction({ kind: "hurt", text: "他刚被打了" });
    const reason = byName("player_hurt_or_died").check(state(), null);
    expect(reason).toContain("他刚被打了");
    expect(reason).toContain("别念稿");
    expect(byName("player_hurt_or_died").priority).toBe(true);
    clearPlayerActions();
  });

  test("捡到好东西 / 完成进度 → 普通通道", () => {
    clearPlayerActions();
    recordPlayerAction({ kind: "pickup", text: "他刚捡到 钻石×3" });
    recordPlayerAction({ kind: "advancement", text: "他完成了进度「探索时间」" });
    const reason = byName("player_did_something").check(state(), null);
    expect(reason).toContain("钻石×3");
    expect(reason).toContain("探索时间");
    expect(byName("player_did_something").priority).toBeUndefined();
    clearPlayerActions();
  });

  test("紧急的和闲聊的互相不抢（各自取各自的）", () => {
    clearPlayerActions();
    recordPlayerAction({ kind: "dead", text: "他刚刚死了" });
    recordPlayerAction({ kind: "sleep", text: "他睡下了" });
    const urgent = byName("player_hurt_or_died").check(state(), null);
    expect(urgent).toContain("死了");
    expect(urgent).not.toContain("睡下");
    // 闲聊的还在，下一跳会说
    expect(byName("player_did_something").check(state(), null)).toContain("睡下");
    clearPlayerActions();
  });

  test("没有动作时完全不吭声（不能凭空捏造'他刚做了什么'）", () => {
    clearPlayerActions();
    expect(byName("player_hurt_or_died").check(state(), null)).toBeNull();
    expect(byName("player_did_something").check(state(), null)).toBeNull();
  });

  test("同一件事不会说两遍", () => {
    clearPlayerActions();
    recordPlayerAction({ kind: "join", text: "他上线了" });
    expect(byName("player_did_something").check(state(), null)).toContain("上线");
    expect(byName("player_did_something").check(state(), null)).toBeNull();
    clearPlayerActions();
  });
});
