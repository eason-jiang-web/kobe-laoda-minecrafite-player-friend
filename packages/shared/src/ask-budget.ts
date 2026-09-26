/**
 * 追问预算 —— 同一件事最多问 N 次，问满就必须自己拍板。
 *
 * 为什么需要它：玩家给的信息天生是模糊的（「就那个地方」「你懂的」「随便」）。
 * 一个只会追问的搭子会变成审讯室 —— 而且第三次之后问出来的信息量基本是零。
 * 这时候正确做法是拿最合理的假设去干，干错了再改，比原地打转强得多。
 *
 * 分工：身体（mc-bot）负责说话 + 存盘，判断逻辑全在这儿，纯函数好测。
 */

export interface AskRecord {
  /** 话题键（同一件事必须用同一个 key，见 askKey）。 */
  key: string;
  /** 已经问过几次。 */
  count: number;
  /** 最近一次问的时间。 */
  lastAt: number;
  /** 最近一次问的原话 —— 问满之后要拿它告诉大脑「这件事别再问了」。 */
  lastQuestion: string;
}

export interface AskPolicy {
  /** 同一个话题最多问几次。 */
  maxPerTopic: number;
  /** 超过这么久没再问，额度重置 —— 换个时间碰到同类问题还能问。 */
  windowMs: number;
  /** 窗口内**所有**话题加起来的上限，防止换个说法接着问。 */
  maxPerWindow: number;
}

export const ASK_MAX_DEFAULT = 3;
export const ASK_WINDOW_MS_DEFAULT = 10 * 60_000;
export const ASK_WINDOW_MAX_DEFAULT = 5;

export const DEFAULT_ASK_POLICY: AskPolicy = {
  maxPerTopic: ASK_MAX_DEFAULT,
  windowMs: ASK_WINDOW_MS_DEFAULT,
  maxPerWindow: ASK_WINDOW_MAX_DEFAULT,
};

/**
 * 归一化话题键：小写、去掉空白和标点、截断。
 * 目的是让「去哪个地方」「去哪儿」「哪里」这种同义说法尽量落到同一个键上 ——
 * 不然换个说法就能绕开额度。真绕开了还有 maxPerWindow 兜底。
 */
export function askKey(topic: string | undefined, question: string): string {
  const source = (topic ?? "").trim().length > 0 ? (topic as string) : question;
  const norm = source
    .trim()
    .toLowerCase()
    .replace(/[\s，。、！？!?,.：:；;、"'「」【】()（）~～-]/g, "");
  return norm.slice(0, 40).length > 0 ? norm.slice(0, 40) : "unknown";
}

/** 丢掉过期记录（额度窗口之外的不算数）。 */
export function pruneAsks(
  records: AskRecord[],
  now: number,
  policy: AskPolicy = DEFAULT_ASK_POLICY,
): AskRecord[] {
  return records.filter((r) => now - r.lastAt < policy.windowMs);
}

export interface AskVerdict {
  allowed: boolean;
  /** 这次是第几次（allowed 时有效）。 */
  count: number;
  /** 这个话题还剩几次额度。 */
  remaining: number;
  /** 不让问的原因 —— 直接回给模型看，所以要说清楚下一步该干嘛。 */
  why?: string;
}

/**
 * 现在能不能问。两种拒绝理由分开写，因为给模型的话术不一样：
 *   - 同一件事问满了 → 别再问了，自己拍板；
 *   - 短时间内问太密 → 先干点实事。
 */
export function decideAsk(
  records: AskRecord[],
  key: string,
  question: string,
  now: number,
  policy: AskPolicy = DEFAULT_ASK_POLICY,
): AskVerdict {
  const live = pruneAsks(records, now, policy);
  const mine = live.find((r) => r.key === key);
  const used = mine?.count ?? 0;

  if (used >= policy.maxPerTopic) {
    return {
      allowed: false,
      count: used,
      remaining: 0,
      why:
        "「" + (mine?.lastQuestion ?? question) + "」这件事你已经问过 " + used + " 次了 —— 再问也没用，这条没发出去。" +
        "换个做法：按你手上最合理的假设**直接开工**，然后用 chat 一句话告诉他你怎么理解的" +
        "（比如「行，那我按最近那个村子理解」）。干错了改一次，比站着问第四遍强。",
    };
  }

  const inWindow = live.reduce((n, r) => n + r.count, 0);
  if (inWindow >= policy.maxPerWindow) {
    return {
      allowed: false,
      count: used,
      remaining: 0,
      why:
        "你最近 " + Math.round(policy.windowMs / 60_000) + " 分钟内已经问了 " + inWindow +
        " 次了 —— 太密，这条没发出去。先干点实事：拿最合理的假设开工，" +
        "或者用 chat 说一句「那我先按 X 干」然后动手。",
    };
  }

  return { allowed: true, count: used + 1, remaining: policy.maxPerTopic - used - 1 };
}

/** 记一次成功的追问，返回新数组（身体拿去存）。 */
export function recordAsk(
  records: AskRecord[],
  key: string,
  question: string,
  now: number,
  policy: AskPolicy = DEFAULT_ASK_POLICY,
): AskRecord[] {
  const live = pruneAsks(records, now, policy);
  const used = live.find((r) => r.key === key)?.count ?? 0;
  const rest = live.filter((r) => r.key !== key);
  return [...rest, { key, count: used + 1, lastAt: now, lastQuestion: question.slice(0, 60) }];
}

/**
 * 唤醒大脑前贴给它的一行提示：有话题问满时才有。
 * 这是「别问了」的第二道保险 —— 让模型在开口之前就知道额度用完了，
 * 而不是等它调 ask_player 被拒才发现。
 */
export function askHint(
  records: AskRecord[],
  now: number,
  policy: AskPolicy = DEFAULT_ASK_POLICY,
): string | null {
  const full = pruneAsks(records, now, policy).filter((r) => r.count >= policy.maxPerTopic);
  if (full.length === 0) return null;
  return (
    "★ 有些事你已经问到上限了，这次别再问：" +
    full
      .map((r) => "「" + r.lastQuestion + "」问过 " + r.count + " 次 —— 直接按最合理的假设干，动手前用一句话讲清你的理解。")
      .join(" ")
  );
}
