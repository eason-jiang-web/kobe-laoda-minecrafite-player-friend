/**
 * 训练日志：每被唤醒一次，就落一条 JSONL。
 *
 * 为什么要它：模型"变聪明"的唯一靠谱路径是**有数据**。这条日志记录的正是
 * 训练需要的那三元组 ——
 *   当时发生了什么（reason + 世界快照）
 *   → 它决定做什么（tools：名字、参数、每个工具的真实返回）
 *   → 结果和玩家的评价（said / feedback）
 *
 * 格式（append-only，一天一个文件，方便之后直接喂给微调/评估脚本）：
 *   data/training/turns-YYYY-MM-DD.jsonl   每行一个 TrainingTurn
 *   data/training/labels.jsonl             每行一个 { at, label: "good"|"bad" }
 *
 * 玩家的评价来自游戏里的 #good / #bad（由 apps/mc-bot/src/training-labels.ts 写，
 * 那边只负责"打分"，不碰 turns 文件；两边在 export 时按时间就近配对）。
 */
import { appendFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface TrainingToolCall {
  name: string;
  /** 模型给的原样参数（JSON 字符串）。 */
  args: string;
  /** 工具真正返回了什么（截断过）。 */
  result: string;
  /** 是不是重复调用被系统丢掉的。 */
  skipped?: boolean;
}

export interface TrainingTurn {
  id: string;
  at: number;
  model: string;
  /** 唤醒原因：谁说了什么 / 什么触发了。 */
  reason: string;
  /** 模型看到的世界快照（紧凑文本）。 */
  state: string;
  tools: TrainingToolCall[];
  /** 最后决定在游戏里说的那句话（可能为空 = 保持沉默）。 */
  said: string;
  steps: number;
  ms: number;
  /** 完整的 system+user 提示（BRAIN_TRAIN_FULL=1 时才写，文件会大很多）。 */
  prompt?: string;
}

export interface FeedbackLabel {
  at: number;
  label: "good" | "bad";
}

export function trainDir(): string {
  return process.env.BRAIN_TRAIN_DIR ?? "data/training";
}

function turnsFile(dir: string, at: number): string {
  const day = new Date(at).toISOString().slice(0, 10);
  return join(dir, `turns-${day}.jsonl`);
}

export function appendTurn(turn: TrainingTurn, dir = trainDir()): void {
  mkdirSync(dir, { recursive: true });
  appendFileSync(turnsFile(dir, turn.at), JSON.stringify(turn) + "\n");
}

export function appendLabel(label: "good" | "bad", at = Date.now(), dir = trainDir()): void {
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, "labels.jsonl"), JSON.stringify({ at, label }) + "\n");
}

function readJsonl<T>(file: string): T[] {
  try {
    return readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

export function readTurns(dir = trainDir()): TrainingTurn[] {
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.startsWith("turns-") && f.endsWith(".jsonl"));
  } catch {
    return [];
  }
  return files
    .flatMap((f) => readJsonl<TrainingTurn>(join(dir, f)))
    .sort((a, b) => a.at - b.at);
}

export function readLabels(dir = trainDir()): FeedbackLabel[] {
  return readJsonl<FeedbackLabel>(join(dir, "labels.jsonl"));
}

export interface LabelledTurn extends TrainingTurn {
  feedback?: "good" | "bad";
}

/**
 * 把评价贴到"它评价的那一轮"上：取**在该评价之前、时间上最近**的那一轮
 * （超过 maxGapMs 就认为这条评价没有对应轮次，丢掉）。
 */
export function joinTurnsWithLabels(
  turns: TrainingTurn[],
  labels: FeedbackLabel[],
  maxGapMs = 10 * 60_000,
): LabelledTurn[] {
  const out: LabelledTurn[] = turns.map((t) => ({ ...t }));
  for (const label of labels) {
    let best: LabelledTurn | null = null;
    for (const turn of out) {
      if (turn.at > label.at) break;
      if (label.at - turn.at <= maxGapMs) best = turn;
    }
    if (best) best.feedback = label.label;
  }
  return out;
}
