/**
 * 给机器人开 op 的纯逻辑（CLI 在 scripts/op-bot.ts）。
 *
 * 为什么需要这个：服务端不让玩家自己 op 自己，所以想让 牢大 能瞬移，
 * 要么你在游戏里手打一次 /op Laoda，要么**在世界关掉的时候**把它写进
 * ops.json。后者不用打指令 —— 这个文件就是那件事的计算部分。
 *
 * 关键点：ops.json 认的是 UUID，不是名字。离线模式的 UUID 由
 * Java 的 UUID.nameUUIDFromBytes("OfflinePlayer:"+name) 算出（MD5 + v3 位），
 * 算错一位就等于没写，所以这里用真实世界的 usercache.json 做了回归测试。
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** 离线模式 UUID：和 Java 的 UUID.nameUUIDFromBytes 逐位一致。 */
export function offlineUuid(name: string): string {
  const h = createHash("md5").update("OfflinePlayer:" + name, "utf8").digest();
  h[6] = ((h[6] ?? 0) & 0x0f) | 0x30; // version 3
  h[8] = ((h[8] ?? 0) & 0x3f) | 0x80; // IETF variant
  const hex = h.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export interface OpsEntry {
  uuid: string;
  name: string;
  /** 4 = 完全权限（和 /op 出来的效果一样）。 */
  level: number;
  bypassesPlayerLimit: boolean;
}

export function opsEntry(name: string, uuid: string): OpsEntry {
  return { uuid, name, level: 4, bypassesPlayerLimit: false };
}

/** 从 java 命令行里抠 --gameDir（PCL 开了版本隔离时，世界就在这里面）。 */
export function parseGameDir(commandLine: string): string | null {
  const m = /--gameDir\s+("([^"]*)"|\S+)/.exec(commandLine);
  if (!m) return null;
  const quoted = m[2];
  return quoted !== undefined ? quoted : (m[1] ?? null);
}

/**
 * 把一条 op 记录并进 ops.json：保留别人、不重复写自己、坏文件不当场炸。
 * 返回写回磁盘的完整内容。
 */
export function mergeOpsFile(existing: string | null, entry: OpsEntry): string {
  let parsed: unknown = [];
  if (existing && existing.trim()) {
    try {
      parsed = JSON.parse(existing);
    } catch {
      parsed = [];
    }
  }
  const list = Array.isArray(parsed) ? parsed : [];
  const kept = list.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && (item as { uuid?: unknown }).uuid !== entry.uuid,
  );
  kept.push(entry as unknown as Record<string, unknown>);
  return JSON.stringify(kept, null, 2) + "\n";
}

/** 默认的探测方式：借 .NET 的 FileShare.None 独占打开。 */
function runPowerShell(script: string): string {
  // 刻意只写单引号：cmd /c 会把 \" 吃掉，双层引号是这类脚本的经典翻车点。
  return execSync('powershell -NoProfile -Command "' + script + '"', {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

/**
 * 世界现在被游戏加载着吗？（= 现在能不能安全写 ops.json）
 *
 * `session.lock` 是内置服务端加载存档时锁上的文件 —— **这是唯一能把"人在存档里"
 * 和"人在标题画面"分开的信号**：光看 java 进程，这两种情况一模一样。
 *
 * Node 自己开文件的共享模式太宽松（实测 r / r+ / a+ 在世界开着时照样打开成功），
 * 所以借 .NET 的 FileShare.None。
 *
 * **探测不出来一律当"占用"** —— 宁可不写，也不要写完被服务端覆盖掉还跟你说成功了。
 */
export function isWorldLoaded(
  worldDir: string,
  run: (script: string) => string = runPowerShell,
): boolean {
  const lock = join(worldDir, "session.lock");
  if (!existsSync(lock)) return false; // 还没锁过 = 没人开着

  const quoted = lock.replace(/'/g, "''");
  const script =
    "$p='" +
    quoted +
    "'; try { $f=[System.IO.File]::Open($p,[System.IO.FileMode]::Open," +
    "[System.IO.FileAccess]::ReadWrite,[System.IO.FileShare]::None); $f.Close(); 'FREE' } catch { 'LOCKED' }";

  try {
    const out = run(script);
    if (out.includes("FREE")) return false;
    if (out.includes("LOCKED")) return true;
    return true;
  } catch {
    return true;
  }
}

/** usercache.json 里有服务端亲手写的 UUID —— 有它就不用自己算。 */
export function uuidFromUsercache(json: string | null, name: string): string | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    const hit = parsed.find(
      (item) => item && typeof item === "object" && (item as { name?: unknown }).name === name,
    ) as { uuid?: unknown } | undefined;
    return typeof hit?.uuid === "string" ? hit.uuid : null;
  } catch {
    return null;
  }
}
