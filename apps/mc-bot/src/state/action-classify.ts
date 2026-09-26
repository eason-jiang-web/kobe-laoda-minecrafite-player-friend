/**
 * 从服务器的播报文字里认出"玩家的动作"。
 *
 * 死亡、睡觉、完成进度、上下线这些事**没有对应的 mineflayer 事件**，
 * 只以聊天栏播报出现（"eason 被 僵尸 杀死了" / "eason 完成了进度 [探索时间]"）。
 * 所以拿真实播报文字做模式匹配 —— 中英文都认（服务端语言可能是英文）。
 *
 * 纯函数：给一行文字，返回动作或 null。好测，也不会误伤别的东西。
 */
import type { PlayerActionKind } from "./player-actions.js";

export interface ClassifiedAction {
  kind: PlayerActionKind;
  text: string;
  important?: boolean;
}

/** 死亡的各种死法（英文是原版，中文是中文客户端/服务端）。 */
const DEATH_PATTERNS = [
  /被.+?杀(死|害)/,
  /被.+?射杀/,
  /掉出了这个世界/,
  /在岩浆里游泳/,
  /被岩浆烧死/,
  /摔死了/,
  /饿死了/,
  /窒息/,
  /was slain by/,
  /was shot by/,
  /was blown up by/,
  /was killed by/,
  /burned to death/,
  /drowned/,
  /hit the ground too hard/,
  /fell from a high place/,
  /starved to death/,
  /withered away/,
  /fell out of the world/,
];

const ADVANCEMENT_PATTERNS = [
  /完成了进度/,
  /达成了挑战/,
  /达成了目标/,
  /has made the advancement/,
  /has completed the challenge/,
  /has reached the goal/,
];

const SLEEP_PATTERNS = [/睡着了/, /is now sleeping/, /is sleeping/];
const WAKE_PATTERNS = [/起床了/, /woke up/, /left their bed/];
const JOIN_PATTERNS = [/加入了游戏/, /joined the game/];
const LEAVE_PATTERNS = [/退出了游戏/, /left the game/];

/**
 * 认一行播报。返回 null 表示"这不是玩家动作"。
 * `owner` 用来判断是不是**他**（不是他就不叫醒大脑）。
 */
export function classifySystemLine(line: string, owner: string): ClassifiedAction | null {
  const text = line.trim();
  if (text.length === 0 || owner.length === 0) return null;
  // 自己的名字必须出现（"Laoda 被僵尸杀死"不该当成他出事）
  if (!text.toLowerCase().includes(owner.toLowerCase())) return null;
  // 玩家自己发的聊天（<eason> 你好）不算动作
  if (text.startsWith("<")) return null;

  const hit = (patterns: RegExp[]) => patterns.some((re) => re.test(text));

  if (hit(DEATH_PATTERNS)) {
    const killer = /被\s*(.+?)\s*(?:杀|射)/.exec(text)?.[1];
    return {
      kind: "dead",
      important: true,
      text:
        "他刚刚死了" + (killer ? "（凶手：" + killer + "）" : "") +
        " —— 掉落物还在地上，先安慰一句，再问要不要去把东西捡回来（掉落物过几分钟就会消失）。",
    };
  }
  if (hit(ADVANCEMENT_PATTERNS)) {
    const name = /[\[【]([^\]】]+)[\]】]/.exec(text)?.[1] ?? "某个进度";
    return {
      kind: "advancement",
      important: true,
      text: "他完成了进度「" + name + "」—— 恭喜一下（这是真本事），顺嘴可以点一句下一步大概要干嘛。",
    };
  }
  if (hit(SLEEP_PATTERNS)) {
    return { kind: "sleep", text: "他睡下了 —— 别吵他，天亮/他醒了再说。" };
  }
  if (hit(WAKE_PATTERNS)) {
    return { kind: "wake", text: "他起床了 —— 可以打个招呼，新的一天开始了。" };
  }
  if (hit(JOIN_PATTERNS)) {
    return { kind: "join", text: "他上线了 —— 打个招呼，顺便说一句你这边在干嘛。" };
  }
  if (hit(LEAVE_PATTERNS)) {
    return { kind: "leave", text: "他下线了 —— 记一下他最后的位置，别乱跑，等他回来。" };
  }
  return null;
}
