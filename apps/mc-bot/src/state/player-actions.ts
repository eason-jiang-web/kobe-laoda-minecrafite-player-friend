/**
 * "他刚干了什么" —— 玩家的动作事件流。
 *
 * 为什么单独一层：原来的触发器只能看**当前快照**（背包、血、附近怪），
 * 于是"他刚被打了""他刚捡到钻石""他完成了进度"这类**一瞬间发生的事**根本没法反应 ——
 * 而搭子最该有反应的就是这些。
 *
 * 数据从两处来（见 action-watch.ts）：
 *   ① mineflayer 事件：entityHurt（他被打）、playerCollect（他捡东西）、advancement（他完成进度）
 *   ② 服务器的播报文字：谁死了、谁睡着了、谁上线了 —— 这些只以聊天栏播报的形式出现
 *
 * 这里只管"记下来 + 取走"，判定逻辑是纯的，好测。取走用 take（按类型过滤），
 * 这样"紧急的"和"闲聊的"可以由两个触发器分别消费，互不抢。
 */

export type PlayerActionKind =
  | "hurt"
  | "dead"
  | "pickup"
  | "drop"
  | "advancement"
  | "sleep"
  | "wake"
  | "join"
  | "leave";

export interface PlayerAction {
  kind: PlayerActionKind;
  /** 给大脑看的一句话（中文，已带上关键细节）。 */
  text: string;
  at: number;
  /** 值得特意说一句的（稀有的东西、进度）。 */
  important?: boolean;
}

/** 最多留这么多条，免得堆积。 */
const MAX = 24;
/** 超过这么久没被消费就丢掉：隔了 5 分钟再说"他刚被打了"很怪。 */
const TTL_MS = 60_000;

let buffer: PlayerAction[] = [];

export function recordPlayerAction(
  action: Omit<PlayerAction, "at">,
  now = Date.now(),
): void {
  buffer.push({ ...action, at: now });
  if (buffer.length > MAX) buffer = buffer.slice(-MAX);
}

function fresh(now: number): PlayerAction[] {
  buffer = buffer.filter((a) => now - a.at < TTL_MS);
  return buffer;
}

/**
 * 取走（并移除）匹配的动作。默认全取。
 * 两个触发器分别取自己关心的类型，谁也看不到对方的（也就不会重复反应）。
 */
export function takePlayerActions(
  kinds?: PlayerActionKind[],
  now = Date.now(),
): PlayerAction[] {
  const alive = fresh(now);
  if (!kinds || kinds.length === 0) {
    buffer = [];
    return alive;
  }
  const wanted = new Set(kinds);
  const taken = alive.filter((a) => wanted.has(a.kind));
  buffer = alive.filter((a) => !wanted.has(a.kind));
  return taken;
}

/** 只看不取（调试/状态展示用）。 */
export function peekPlayerActions(now = Date.now()): PlayerAction[] {
  return [...fresh(now)];
}

/** 断开重连/换世界时清空，免得旧事件穿越到新会话。 */
export function clearPlayerActions(): void {
  buffer = [];
}
