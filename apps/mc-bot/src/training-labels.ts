/**
 * 玩家给刚才那一轮"打分"。
 *
 * 只写评价，不碰 turns 文件 —— 回合日志由大脑那边写
 * （apps/brain-deepseek/src/training-log.ts），两边在 export 时按时间就近配对。
 * 这样身体和大脑不需要共享任何运行时状态，各自 append 就行。
 *
 * 格式：data/training/labels.jsonl，每行 { at, label: "good" | "bad" }
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type FeedbackLabel = "good" | "bad";

export function trainDir(): string {
  return process.env.BRAIN_TRAIN_DIR ?? "data/training";
}

export function appendLabel(label: FeedbackLabel, at = Date.now(), dir = trainDir()): void {
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, "labels.jsonl"), JSON.stringify({ at, label }) + "\n");
}
