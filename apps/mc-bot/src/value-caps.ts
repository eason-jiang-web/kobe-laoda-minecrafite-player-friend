/**
 * 玩家自定义的物资上限（#value 铁 400）。
 *
 * 为什么放在身体这边而不是 shared：**它要读写文件**，而 shared 会被打进网页端。
 * 上限本身会盖到世界快照上（GameState.valueCaps），所以评估函数、向导、大脑
 * 都读得到同一份数据，不需要到处传参。
 *
 * 存 data/value-caps.json —— 重启不丢。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type CapOverrides = Record<string, number>;

const FILE = "data/value-caps.json";

let cache: CapOverrides | null = null;

export function capsPath(): string {
  return process.env.MC_VALUE_CAPS_FILE ?? FILE;
}

export function loadCaps(): CapOverrides {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(readFileSync(capsPath(), "utf8"));
    cache = typeof parsed === "object" && parsed !== null ? (parsed as CapOverrides) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function save(): void {
  try {
    const file = capsPath();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(loadCaps(), null, 2));
  } catch {
    // 存不下也不该让游戏崩：内存里这份还能用
  }
}

/** 改上限（绝对总数）。cap <= 0 表示"不限量"。 */
export function setCap(key: string, cap: number): void {
  loadCaps()[key] = Math.max(0, Math.round(cap));
  save();
}

export function clearCap(key: string): void {
  delete loadCaps()[key];
  save();
}

export function currentCaps(): CapOverrides {
  return loadCaps();
}

/**
 * 中文（或英文）写法 → 需求组名 / 物品名。
 * 认识组名就够了（铁、钻石…），也允许直接写物品 id（raw_iron）。
 */
const ALIASES: Record<string, string> = {
  铁: "iron", 铁锭: "iron", 铁矿: "iron",
  金: "gold", 金子: "gold", 金锭: "gold",
  钻石: "diamond", 钻: "diamond",
  下界合金: "netherite", 残骸: "netherite", 远古残骸: "netherite",
  煤: "coal", 煤炭: "coal", 木炭: "coal",
  木头: "wood", 原木: "wood", 木材: "wood", 木料: "wood",
  石头: "stone", 圆石: "stone", 石料: "stone",
  红石: "redstone", 青金石: "lapis", 吃的: "food", 食物: "food", 粮食: "food",
};

/** 返回 null = 不认识，让调用方报错。 */
export function resolveItemKey(input: string): string | null {
  const raw = input.trim();
  if (raw.length === 0) return null;
  const lower = raw.toLowerCase();
  if (ALIASES[raw]) return ALIASES[raw]!;
  if (ALIASES[lower]) return ALIASES[lower]!;
  // 直接写物品 id / 组名
  if (/^[a-z0-9_]+$/.test(lower)) return lower;
  return null;
}

/** 给错误信息用：现在能改哪些。 */
export function knownKeys(): string[] {
  return ["iron", "gold", "diamond", "netherite", "wood", "stone", "coal", "redstone", "lapis", "food"];
}
