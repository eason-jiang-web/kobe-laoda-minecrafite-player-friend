/**
 * 把本机 Minecraft 的官方中文语言文件读进来。
 *
 * 为什么这么绕：物品的中文名在客户端的语言文件里（`assets/objects` 里那份
 * zh_cn.json，8500+ 条），mineflayer 给的是英文 id（oak_log）。想让他眼里的
 * 世界说中文，最准的就是直接读游戏自己那份 —— 和你在屏幕上看到的逐字一致，
 * 也不用我手写几千条（手写的迟早对不上）。
 *
 * 找法不用解压 jar：`assets/indexes/<版本>.json` 是资源索引，
 * 里面记着 `minecraft/lang/zh_cn.json` 的 sha1；文件本体在
 * `assets/objects/<前两位>/<sha1>`。挑最新的那份索引就行（内容几乎一样）。
 *
 * 读不到不是错误：退回 @itto/shared 里的兜底词典，最差显示英文 id。
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { setChineseNames } from "@itto/shared";

export interface ZhLoadResult {
  /** 收下的条目数（物品+方块+生物）。 */
  count: number;
  /** 从哪儿读的，写日志用。 */
  source: string;
}

/**
 * 在候选目录里找 `assets/indexes`。
 *
 * 要往上走几层：PCL 开了版本隔离时游戏目录是
 * `...\.minecraft\versions\1.20.6`，资源目录在再上面两层的 `.minecraft` 里；
 * 没开隔离时它本身就是 `.minecraft`。所以往上最多找 3 层。
 */
export function findMcRoot(candidates: string[], maxUp = 3): string | null {
  for (const c of candidates) {
    if (!c) continue;
    let dir = c;
    for (let i = 0; i <= maxUp; i++) {
      if (existsSync(join(dir, "assets", "indexes"))) return dir;
      const up = dirname(dir);
      if (up === dir) break; // 到盘符根了
      dir = up;
    }
  }
  return null;
}

/**
 * 从资源索引里挑一份带 zh_cn 的（最新改动的优先），返回语言文件路径。
 */
export function findLanguageFile(mcRoot: string): string | null {
  const indexes = join(mcRoot, "assets", "indexes");
  if (!existsSync(indexes)) return null;

  const files = readdirSync(indexes)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const path = join(indexes, f);
      try {
        return { path, mtime: statSync(path).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter((x): x is { path: string; mtime: number } => x !== null)
    .sort((a, b) => b.mtime - a.mtime);

  for (const idx of files) {
    try {
      const parsed = JSON.parse(readFileSync(idx.path, "utf8")) as {
        objects?: Record<string, { hash?: string }>;
      };
      const hash = parsed.objects?.["minecraft/lang/zh_cn.json"]?.hash;
      if (!hash || hash.length < 4) continue;
      const obj = join(mcRoot, "assets", "objects", hash.slice(0, 2), hash);
      if (existsSync(obj)) return obj;
    } catch {
      // 坏索引就跳过，试下一份
    }
  }
  return null;
}

/**
 * 读语言文件 → 灌进 @itto/shared。返回 null 表示没找到（不是错误）。
 */
export function loadChineseNames(candidates: string[]): ZhLoadResult | null {
  const root = findMcRoot(candidates);
  if (!root) return null;
  const file = findLanguageFile(root);
  if (!file) return null;

  try {
    const entries = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
    const count = setChineseNames(entries);
    return count > 0 ? { count, source: file } : null;
  } catch {
    return null;
  }
}
