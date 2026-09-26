/**
 * bun run train:export
 *
 * 把 data/training 里两个 append-only 文件合成一份可直接用的数据集：
 *   turns-*.jsonl（每轮决策） + labels.jsonl（你的 #good / #bad）
 *   → dataset.jsonl（带 feedback 字段）
 *
 * 顺便打一份体检报告：多少轮、说了多少句、工具用了什么、你打了多少分。
 * 之后想微调/评估，直接读 dataset.jsonl 就行。
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  joinTurnsWithLabels,
  readLabels,
  readTurns,
  trainDir,
} from "../apps/brain-deepseek/src/training-log.js";

const dir = trainDir();
const turns = readTurns(dir);
const labels = readLabels(dir);

if (turns.length === 0) {
  console.log("");
  console.log("  还没有任何训练数据（" + dir + " 是空的）。");
  console.log("  先跑一会儿机器人 —— 每次它被唤醒都会写一条。");
  console.log("");
  process.exit(0);
}

const joined = joinTurnsWithLabels(turns, labels);
const out = join(dir, "dataset.jsonl");
writeFileSync(out, joined.map((t) => JSON.stringify(t)).join("\n") + "\n");

const spoke = joined.filter((t) => t.said.length > 0).length;
const good = joined.filter((t) => t.feedback === "good").length;
const bad = joined.filter((t) => t.feedback === "bad").length;

const toolCounts = new Map<string, number>();
for (const turn of joined) {
  for (const call of turn.tools) toolCounts.set(call.name, (toolCounts.get(call.name) ?? 0) + 1);
}
const topTools = [...toolCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

const first = new Date(joined[0]!.at);
const last = new Date(joined[joined.length - 1]!.at);
const mins = Math.max(1, Math.round((last.getTime() - first.getTime()) / 60_000));
const avgMs = Math.round(joined.reduce((n, t) => n + t.ms, 0) / joined.length);
const avgTools = (joined.reduce((n, t) => n + t.tools.length, 0) / joined.length).toFixed(1);

console.log("");
console.log("  ── 训练数据体检 ──────────────────────────────");
console.log("   回合数      " + joined.length + "（" + mins + " 分钟的记录）");
console.log("   开口说话    " + spoke + " 次（" + Math.round((spoke / joined.length) * 100) + "%）");
console.log("   平均耗时    " + avgMs + "ms / 平均工具调用 " + avgTools + " 次");
console.log("   你的评价     👍 " + good + "   👎 " + bad + (good + bad === 0 ? "（还没打过分，游戏里打 #good / #bad）" : ""));
if (topTools.length > 0) {
  console.log("   用过最多的工具");
  for (const [name, count] of topTools) console.log("      " + name.padEnd(18) + count);
}
console.log("   导出到      " + out);
console.log("  ──────────────────────────────────────────────");
console.log("");
