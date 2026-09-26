/**
 * 牢大 的"被动技能"：热梗自动弹出。
 *
 * 角色卡给了明确的概率 —— 打架 30%、兄弟挨打 50%、闲聊 10%、绝境 100%。
 * 这是个**掷骰子**的事，所以放在身体里（便宜、确定、可测），而不是交给模型
 * 的心情：**掷骰子决定要不要弹，大脑决定怎么说**。
 *
 * 这样既保住了角色卡的"被动技能"手感，又不会让聊天变成复读机 ——
 * 掷中了也只是给个提示，大脑觉得不合适可以不接。
 */
import type { GameState } from "@itto/shared";

export type MemeSituation = "desperate" | "combat" | "brother-hurt" | "idle";

export interface MemeRoll {
  situation: MemeSituation;
  /** 卡里要求他脱口而出的那句。 */
  line: string;
  /** 100% 那一档：这句不是可选的。 */
  forced: boolean;
}

/** 概率直接照抄角色卡。 */
const ODDS: Record<MemeSituation, number> = {
  desperate: 1,
  combat: 0.3,
  "brother-hurt": 0.5,
  idle: 0.1,
};

const LINES: Record<MemeSituation, string[]> = {
  combat: [
    "肘！跟我上！看我的闪电旋风劈！",
    "这波直接给他送走！",
    "别慌，看我起飞，越塔强杀！",
    "What can I say? Mamba out！",
  ],
  "brother-hurt": [
    "哎哟我去，兄弟你这肘得不对啊，角度偏了，我帮你重新开个肘！",
    "别哭，忍一忍，回去给你抹点跌打药。",
    "谁干的？站出来，我给他来个双肘临门！",
  ],
  idle: [
    "这鸡腿不错，肘，跟我回家！",
    "兄弟，我最近在研究一个抽象流派，你要不要试试？",
    "这波不亏，这波是极限操作。",
    "What can I say? 干了！",
  ],
  desperate: [
    "看来，只能用那一招了……闪电旋风劈！",
    "兄弟，这辈子能遇见你，值了！曼巴，启动！",
  ],
};

/** Which of the card's four situations are we in right now? */
export function classifySituation(state: GameState, reason: string): MemeSituation | null {
  const close = state.nearbyHostiles.filter((h) => h.distance <= 12);
  const health = state.self.health;

  // 绝境：自己快没了，或者被围住了
  if (health <= 6 || (close.length >= 3 && health <= 12)) return "desperate";

  // 兄弟挨打：怪就在他身边
  const playerDistance = state.player?.distance ?? null;
  if (close.length > 0 && playerDistance !== null && playerDistance <= 8) return "brother-hurt";

  // 打架：自己身边有怪
  if (close.length > 0) return "combat";

  // 闲聊 / 自由活动
  if (/player said|heartbeat|vibe check|自由活动/.test(reason)) return "idle";

  return null;
}

/**
 * Roll the passive skill. Returns null when the dice say "not this time".
 * `rand` is injectable so the dice are testable.
 */
export function rollMeme(
  state: GameState,
  reason: string,
  rand: () => number = Math.random,
): MemeRoll | null {
  const situation = classifySituation(state, reason);
  if (!situation) return null;
  if (rand() >= ODDS[situation]) return null;

  const pool = LINES[situation];
  const line = pool[Math.floor(rand() * pool.length) % pool.length]!;
  return { situation, line, forced: situation === "desperate" };
}

/** Turn a roll into the hint appended to the nudge. */
export function memeHint(roll: MemeRoll): string {
  return (
    "（抽象被动技能弹出[" + roll.situation + "]：" + roll.line +
    (roll.forced ? " —— 这次必须甩出来" : " —— 想甩就甩，觉得不合适就正常说") +
    "）"
  );
}
