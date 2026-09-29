/**
 * 「别复读」—— 判断这句话最近是不是已经说过了。
 *
 * 为什么要在**身体**里拦，而不是靠提示词劝：大脑每次唤醒都是新进程，它只能靠
 * history 知道刚才说了什么，而实测它就是会一遍遍甩同一句 ——
 * 真实历史里连着四条「砍树任务还在跑，不吭声了。」。提示词能劝，劝不住。
 *
 * 两条判定，阈值刻意定得**高**：
 *   1. 归一化（去空白/标点/大小写）后一模一样  → 拦
 *   2. 相似度 >= 0.9（只差一个「了」这种）      → 拦
 * 宁可漏掉几个近义复读，也不能把「我去挖矿」和「我去砍树」当成同一句拦掉 ——
 * 那会把正常聊天也堵死。
 */

export interface SaidLine {
  text: string;
  /** epoch ms */
  at: number;
}

/** 多久之内算「刚说过」。 */
export const REPEAT_WINDOW_MS = 5 * 60_000;
/** 相似度到多少算同一句。 */
export const REPEAT_SIMILARITY = 0.9;

/** 归一化：大小写、空白、标点、符号（含 emoji）全部去掉。 */
export function normalizeLine(s: string): string {
  return s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

/** 字符二元组的 Dice 相似度（0..1）。中文短句上比编辑距离稳。 */
export function similarity(a: string, b: string): number {
  const x = normalizeLine(a);
  const y = normalizeLine(b);
  if (x.length === 0 || y.length === 0) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;

  const grams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };

  const ga = grams(x);
  const gb = grams(y);
  let shared = 0;
  for (const [g, n] of ga) shared += Math.min(n, gb.get(g) ?? 0);
  return (2 * shared) / (x.length - 1 + y.length - 1);
}

/** 找到那句说过的话（没有就 null）。 */
export function findRepeat(
  line: string,
  recent: SaidLine[],
  now: number,
  windowMs: number = REPEAT_WINDOW_MS,
  threshold: number = REPEAT_SIMILARITY,
): SaidLine | null {
  const norm = normalizeLine(line);
  if (norm.length === 0) return null;
  for (const r of recent) {
    if (now - r.at >= windowMs) continue;
    if (normalizeLine(r.text) === norm) return r;
    if (similarity(line, r.text) >= threshold) return r;
  }
  return null;
}

/** 记一笔（顺手丢掉过期的，只留最近 keep 条）。 */
export function rememberSaid(
  recent: SaidLine[],
  line: string,
  now: number,
  keep = 20,
  windowMs: number = REPEAT_WINDOW_MS,
): SaidLine[] {
  const fresh = recent.filter((r) => now - r.at < windowMs);
  return [...fresh, { text: line, at: now }].slice(-keep);
}
