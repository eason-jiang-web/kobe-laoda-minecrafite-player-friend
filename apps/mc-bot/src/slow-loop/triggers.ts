import { canMine, tierName, type GameState, type Waypoint } from "@itto/shared";
import type { WorldMemory } from "../memory/store.js";
import { takePlayerActions, type PlayerAction, type PlayerActionKind } from "../state/player-actions.js";

/**
 * A trigger is a cheap predicate over game state that decides "is anything
 * here worth waking Claude for?" The slow loop runs these every tick. We keep
 * itto mostly quiet (CONTEXT.md anti-pattern: don't be proactively chatty),
 * so triggers should be conservative and rate-limited by the loop.
 */
export interface Trigger {
  name: string;
  /**
   * Priority triggers cut the queue: they ignore the slow loop's global rate
   * limit and use the brain's short chat cooldown. Reserved for "a human is
   * talking to you right now" — a reply that lands 10s late isn't a reply.
   */
  priority?: boolean;
  /** Return a short reason string if it should fire, else null. */
  check(state: GameState, prev: GameState | null): string | null;
}

/** A trigger that also needs world memory (kept separate so pure triggers stay pure). */
export interface MemoryTrigger {
  name: string;
  check(state: GameState, prev: GameState | null, memory: WorldMemory): string | null;
}

const POINT_PHRASES = [
  "look at this",
  "what do you think",
  "check this out",
  "see this",
  "look",
  "看这个",
  "看看这个",
];

/** Who the bot answers to. Built from config (MC_BOT_USERNAME + MC_WAKE_WORDS). */
export interface TriggerConfig {
  /** The bot's own in-game name — its own chat lines must never wake it. */
  botUsername: string;
  /** Words that mean "the player is talking to me", matched case-insensitively. */
  wakeWords: string[];
  /** Reply to everything the owner says, not only lines that name the bot. */
  replyToAll?: boolean;
}

/**
 * 「他刚干了什么」分两级消费。
 *
 * 紧急的（被打、死了）走优先通道 —— 那两件事晚 10 秒说就没意义了。
 * 其余的（捡到好东西、完成进度、睡觉、上下线）走普通通道，可以等一等。
 *
 * 注意：这里用 take 会**取走**动作。理论上如果这次唤醒被全局限流挡掉，
 * 动作就丢了 —— 实测慢循环 4 秒一跳、限流 2.5 秒，撞上的概率很低；
 * 而且丢的也只是"他捡到钻石"这种闲聊，不是救命信息。
 */
const URGENT_ACTIONS: PlayerActionKind[] = ["hurt", "dead"];
const CASUAL_ACTIONS: PlayerActionKind[] = [
  "pickup",
  "drop",
  "advancement",
  "sleep",
  "wake",
  "join",
  "leave",
];

function actionsToReason(actions: PlayerAction[]): string | null {
  if (actions.length === 0) return null;
  const head = "他刚刚：" + actions.map((a) => a.text).join("；");
  return head + "\n（这是他的动作，不是你看到的静态状态 —— 顺着说一句或者搭把手，别念稿。）";
}

/** Triggers that don't depend on who the bot is. */
const STATIC_TRIGGERS: Trigger[] = [
  {
    name: "player_hurt_or_died",
    priority: true,
    check: () => actionsToReason(takePlayerActions(URGENT_ACTIONS)),
  },
  {
    name: "player_did_something",
    check: () => actionsToReason(takePlayerActions(CASUAL_ACTIONS)),
  },
  {
    name: "incoming_threat",
    check: (s, prev) => {
      const close = s.nearbyHostiles.find((h) => h.distance < 10);
      if (!close) return null;
      // only fire on NEW threats so we don't nag every tick
      const wasClose = prev?.nearbyHostiles.some((h) => h.id === close.id);
      return wasClose ? null : `${close.name} approaching (${close.distance}b)`;
    },
  },
  {
    name: "player_in_danger",
    check: (s) => {
      // we can't see the player's health, but proximity of mobs to them +
      // night is a decent proxy. Placeholder heuristic.
      if (s.player?.distance != null && s.player.distance < 8 && s.nearbyHostiles.length >= 2)
        return "multiple mobs near the player";
      return null;
    },
  },
  {
    name: "self_low_health",
    check: (s, prev) => {
      if (s.self.health <= 6 && (prev?.self.health ?? 20) > 6) return "bot health critical";
      return null;
    },
  },
  {
    name: "inventory_full",
    check: (s, prev) => {
      // heuristic: ~36 inventory slots; fire once when we cross near-full.
      const full = s.inventory.length >= 35;
      const wasFull = (prev?.inventory.length ?? 0) >= 35;
      return full && !wasFull ? "inventory's basically full" : null;
    },
  },
  {
    name: "tool_broke",
    check: (s, prev) => {
      const d = s.self.heldDurability;
      if (!d) return null;
      const ratio = d.current / d.max;
      const pd = prev?.self.heldDurability;
      const pratio = pd ? pd.current / pd.max : 1;
      if (ratio < 0.1 && pratio >= 0.1) return `${s.self.heldItem} is about to break`;
      return null;
    },
  },
  {
    name: "night_falling",
    check: (s, prev) => {
      if (prev == null) return null;
      if (prev.timeOfDay < 12000 && s.timeOfDay >= 12000) return "getting dark out";
      return null;
    },
  },
];

/**
 * Build the trigger set for one bot identity. Only "is the player talking to
 * me?" depends on the name, which is why this is a factory rather than a const:
 * rename the character in .env and everything follows.
 */
export function createTriggers(cfg: TriggerConfig): Trigger[] {
  const botName = cfg.botUsername.toLowerCase();
  const wake = cfg.wakeWords.map((w) => w.toLowerCase()).filter(Boolean);

  const addressed: Trigger = {
    name: "player_addressed_bot",
    priority: true,
    check: (s) => {
      const last = s.recentChat.at(-1);
      if (!last) return null;
      if (last.username.toLowerCase() === botName) return null;

      const lower = last.message.toLowerCase();
      const named =
        POINT_PHRASES.some((p) => lower.includes(p)) || wake.some((w) => lower.includes(w));

      // replyToAll: when the owner says anything at all, it's aimed at you —
      // you're the only other one in the world. Other players still have to
      // name you, so you don't barge into their conversation.
      const owner = s.player?.username?.toLowerCase();
      const fromOwner = owner !== undefined && owner === last.username.toLowerCase();

      if (named || (cfg.replyToAll && fromOwner)) return `player said: "${last.message}"`;
      return null;
    },
  };

  return [addressed, ...STATIC_TRIGGERS];
}

/** How long to wait before re-announcing a new area (avoids spamming while exploring). */
let lastNewAreaFire = 0;
/** 上次提醒"你标记的矿现在能挖了"（别一直念叨同一件事）。 */
let lastOreReadyFire = 0;

export const MEMORY_TRIGGERS: MemoryTrigger[] = [
  {
    name: "reached_new_area",
    check: (s, _prev, memory) => {
      if (Date.now() - lastNewAreaFire < 300_000) return null;
      const wps = memory.recallLocations({ limit: 100 });
      if (wps.length === 0) return null;
      const here = s.self.pos;
      const nearest = Math.min(
        ...wps.map((w) => Math.hypot(here.x - w.pos.x, here.y - w.pos.y, here.z - w.pos.z)),
      );
      if (nearest > 200) {
        lastNewAreaFire = Date.now();
        return "we're somewhere new, far from anywhere you know";
      }
      return null;
    },
  },
  {
    // 之前"挖不动先记着"的矿，现在镐子够了 —— 提醒它回去挖。
    name: "marked_ore_now_mineable",
    check: (s, _prev, memory) => {
      if (Date.now() - lastOreReadyFire < 300_000) return null;

      let ores: Waypoint[];
      try {
        ores = memory.recallLocations({ kind: "ore", limit: 30 });
      } catch {
        return null;
      }
      if (ores.length === 0) return null;

      const here = s.self.pos;
      const ready = ores
        .map((w) => ({
          w,
          block: w.note ?? "",
          dist: Math.hypot(here.x - w.pos.x, here.y - w.pos.y, here.z - w.pos.z),
        }))
        .filter((x) => x.block.length > 0 && x.dist <= 64 && canMine(s.inventory, x.block).can)
        .sort((a, b) => a.dist - b.dist)[0];
      if (!ready) return null;

      lastOreReadyFire = Date.now();
      const verdict = canMine(s.inventory, ready.block);
      return (
        `之前标记的矿现在挖得动了：${ready.block}（标的名字「${ready.w.name}」）在 ${Math.round(ready.dist)} 格外，` +
        `你现在有${tierName(verdict.have)}。想挖就 set_goal 过去，挖完用 forget_location 把标记删掉；不想挖就直说。`
      );
    },
  },
];

/**
 * Periodic "vibe check" — every ~60s consider commenting on the scenery.
 * Stateful so it's separate from the predicate triggers above.
 */
export class VibeCheck {
  private lastAt = Date.now();
  constructor(private readonly intervalMs = 60_000) {}
  due(): boolean {
    if (Date.now() - this.lastAt < this.intervalMs) return false;
    this.lastAt = Date.now();
    return true;
  }
}

/**
 * Heartbeat — wake the brain on a fixed cadence even when nothing happened, so
 * it stays proactive and fully reactive in any circumstance. `intervalMs <= 0`
 * disables it. Costs a brain turn each beat, so keep it modest (default ~30s).
 */
export class HeartbeatCheck {
  private lastAt = Date.now();
  constructor(private readonly intervalMs: number) {}
  due(): boolean {
    if (this.intervalMs <= 0) return false;
    if (Date.now() - this.lastAt < this.intervalMs) return false;
    this.lastAt = Date.now();
    return true;
  }
}
