/**
 * A nudge spawns a fresh brain process, so the only way itto remembers what it
 * just said is a file on disk. We keep a short rolling log of (what woke me ->
 * what I said / did) and feed it back as context, which is the difference
 * between a buddy and a goldfish.
 *
 * Lives in data/ (gitignored) next to the world memory db.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { openerOf } from "@itto/shared";

export interface HistoryEntry {
  /** epoch ms */
  at: number;
  /** what woke the brain (the nudge reason / prompt) */
  reason: string;
  /**
   * 玩家**真的听到**的话（chat 工具发出去的那几句，多句用 ｜ 连）。
   *
   * 注意这里以前存的是"模型最后那段文字"，而那段话**根本不会出现在游戏里** ——
   * 于是它每次醒来都不知道自己刚才说过什么，就一遍遍甩同一句
   * （真实历史：连着四条「砍树任务还在跑，不吭声了。」）。
   */
  said: string;
  /** 模型自己的收尾备注 —— 没发出去过，只代表它当时怎么想的。 */
  note?: string;
  /** MCP tools it called */
  did: string[];
}

export function loadHistory(file: string, keep = 8): HistoryEntry[] {
  try {
    const raw = readFileSync(file, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(-keep);
  } catch {
    return [];
  }
}

export function appendHistory(file: string, entry: HistoryEntry, keep = 24): void {
  try {
    const all = loadHistory(file, keep * 4);
    all.push(entry);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(all.slice(-keep), null, 2));
  } catch {
    // history is a nicety — never let it break a turn
  }
}

function isEntry(v: unknown): v is HistoryEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.at === "number" && typeof e.reason === "string" && typeof e.said === "string";
}

/**
 * 最近几句开场白用得太像时的提醒。
 *
 * 为什么非要有：光把说过的话列出来**反而会强化**这个习惯 —— 它看到「收到 man」
 * 成了自己的风格，就接着用。实测 24 句里 18 句是同一个开头，所以这里必须显式点破。
 */
export function openerWarning(entries: HistoryEntry[]): string | null {
  const said = entries.filter((e) => e.said.length > 0);
  if (said.length < 3) return null;

  const counts = new Map<string, { n: number; sample: string }>();
  for (const e of said) {
    const open = openerOf(e.said);
    if (open.length < 2) continue;
    const hit = counts.get(open);
    if (hit) hit.n += 1;
    else counts.set(open, { n: 1, sample: e.said });
  }
  const worst = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  if (!worst || worst.n < 3) return null;
  return (
    "⚠️ 你最近 " + worst.n + " 句都是「" + worst.sample.slice(0, 10) +
    "…」这个开头 —— 这次换个开场白（或者干脆别说）。"
  );
}

export function formatHistory(entries: HistoryEntry[], now = Date.now()): string {
  const warning = openerWarning(entries);
  const body = entries
    .map((e) => {
      const mins = Math.max(0, Math.round((now - e.at) / 60_000));
      const when = mins < 1 ? "just now" : mins + "m ago";
      // 说清楚哪个是"玩家真的听到了"：这里是防复读最重要的一条信息
      const said = e.said ? ' 说了 "' + clip(e.said, 140) + '"' : " 没说话";
      const did = e.did.length > 0 ? " [" + e.did.join(", ") + "]" : "";
      const note = e.note && e.note !== e.said ? "（心里想：" + clip(e.note, 60) + "）" : "";
      return "- " + when + " | " + clip(e.reason, 160) + " ->" + said + did + note;
    })
    .join("\n");
  return warning ? body + "\n" + warning : body;
}

function clip(s: string, max: number): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max - 1) + "…" : oneLine;
}
