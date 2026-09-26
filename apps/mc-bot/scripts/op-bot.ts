#!/usr/bin/env bun
/**
 * 给机器人开 op —— 不用在游戏里打指令。
 *
 *   bun run op:bot                自己找最新的世界，写进去
 *   bun run op:bot --dry          只看会写什么，不落盘
 *   bun run op:bot --world "新的世界"
 *   bun run op:bot --game "E:\\<你的PCL目录>\\.minecraft\\versions\\1.20.6"
 *
 * 为什么必须**先关世界**：ops.json 是内置服务端读档时载入、退档时回写的，
 * 世界开着改会被覆盖（不会坏档，只是白改）。所以检测到 java 进程就拒绝，
 * 除非 --force —— 双击的 .cmd 会替你确认过再传 --force。
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  isWorldLoaded,
  mergeOpsFile,
  offlineUuid,
  opsEntry,
  parseGameDir,
  uuidFromUsercache,
} from "../src/util/op-bootstrap.js";

const argv = process.argv.slice(2);
const flag = (name: string): boolean => argv.includes("--" + name);
const value = (name: string): string | null => {
  const i = argv.indexOf("--" + name);
  return i >= 0 ? (argv[i + 1] ?? null) : null;
};

const BOT = process.env.MC_BOT_USERNAME?.trim() || "Laoda";
const DRY = flag("dry");
const FORCE = flag("force");
/** 启动器顺手调用：能写就写、不能写就说一句，绝不让启动流程失败。 */
const AUTO = flag("auto");

function log(msg: string) {
  console.log(msg);
}

/** 正在跑的 Minecraft 用的就是它自己的 gameDir —— 比猜准得多。 */
function gameDirFromRunningGame(): string | null {
  // cmd /c 会把 \" 吃掉，所以这里刻意一个内层双引号、一个反斜杠都不写 ——
  // 三层引号嵌套是这类脚本最常见的翻车点。
  const ps = "Get-CimInstance Win32_Process | ForEach-Object { $_.CommandLine }";
  for (const shell of ["powershell", "pwsh"]) {
    try {
      const out = execSync(shell + ' -NoProfile -Command "' + ps + '"', {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      for (const line of out.split(/\r?\n/)) {
        const dir = parseGameDir(line);
        if (dir && existsSync(dir)) return dir;
      }
    } catch {
      // 换个 shell 再试；都不行就走候选目录
    }
  }
  return null;
}

function hasSaves(dir: string): boolean {
  return existsSync(join(dir, "saves"));
}

/**
 * PCL 开了"版本隔离"时，世界在 versions/<版本>/ 里而不是 .minecraft 里。
 * 把 .minecraft 归一化成真正装着存档的那个目录；没有就返回 null。
 */
function normalizeGameDir(dir: string): string | null {
  if (!existsSync(dir)) return null;
  if (hasSaves(dir)) return dir;

  const versions = join(dir, "versions");
  if (!existsSync(versions)) return null;
  let best: { dir: string; mtime: number } | null = null;
  for (const name of readdirSync(versions)) {
    const cand = join(versions, name);
    if (!hasSaves(cand)) continue;
    let mtime = 0;
    try {
      mtime = statSync(cand).mtimeMs;
    } catch {
      continue;
    }
    if (!best || mtime > best.mtime) best = { dir: cand, mtime };
  }
  return best?.dir ?? null;
}

/** 游戏没开时的候选：APPDATA 下的 .minecraft，加上各盘符根目录里的 PCL 和 minecraft 文件夹。 */
function candidateRoots(): string[] {
  const out: string[] = [];
  const appdata = process.env.APPDATA;
  if (appdata) out.push(join(appdata, ".minecraft"));

  for (const drive of ["C", "D", "E", "F", "G", "H"]) {
    const base = drive + ":\\";
    if (!existsSync(base)) continue;
    let names: string[] = [];
    try {
      names = readdirSync(base);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!/^PCL/i.test(name) && !/^\.?minecraft$/i.test(name)) continue;
      const hit = join(base, name);
      out.push(join(hit, ".minecraft"));
      out.push(hit);
    }
  }
  return out;
}

function pickGameDir(): { dir: string; how: string } | null {
  const explicit = value("game") ?? process.env.MC_GAME_DIR?.trim() ?? null;
  if (explicit) {
    const norm = normalizeGameDir(explicit);
    return norm ? { dir: norm, how: "你指定的" } : null;
  }

  const running = gameDirFromRunningGame();
  if (running) {
    const norm = normalizeGameDir(running);
    if (norm) return { dir: norm, how: "从正在运行的游戏里读出来的" };
  }

  for (const cand of candidateRoots()) {
    const norm = normalizeGameDir(cand);
    if (norm) return { dir: norm, how: "扫盘找到的" };
  }
  return null;
}

interface World {
  name: string;
  dir: string;
  mtime: number;
}

function listWorlds(gameDir: string): World[] {
  const saves = join(gameDir, "saves");
  if (!existsSync(saves)) return [];
  const out: World[] = [];
  for (const name of readdirSync(saves)) {
    const dir = join(saves, name);
    try {
      if (!statSync(dir).isDirectory()) continue;
      if (!existsSync(join(dir, "level.dat"))) continue;
      out.push({ name, dir, mtime: statSync(dir).mtimeMs });
    } catch {
      // 权限/竞态，跳过
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

function readUuid(gameDir: string, worldDir: string): { uuid: string; from: string } {
  // 服务端把每个见过的玩家写进 usercache.json（版本目录和世界目录都可能有一份），
  // 那是唯一的"地面真相"；实在没有才自己算。
  for (const path of [join(worldDir, "usercache.json"), join(gameDir, "usercache.json")]) {
    if (!existsSync(path)) continue;
    const uuid = uuidFromUsercache(readFileSync(path, "utf8"), BOT);
    if (uuid) return { uuid, from: "usercache.json（服务端写的）" };
  }
  return { uuid: offlineUuid(BOT), from: "离线模式算出来的" };
}

function main(): number {
  log("");
  if (AUTO) {
    // 启动器的开场白也在这儿打：.cmd 里放不了中文（cmd.exe 会把多字节字符切碎，
    // 实测会把下一行 echo 当成命令执行）。所以 .cmd 只负责调用，中文全从脚本出。
    log("  牢大要进来了 —— 先在游戏里「对局域网开放」，端口 25565；关掉这个窗口 = 他下线。");
    log("");
  } else {
    log("  ── 给 " + BOT + " 开 op ──────────────────────────────");
    log("");
    log("  这是干嘛的：让他能瞬移（#back）、远路抄近路、还能用服务器指令。");
    log("  什么时候点：他在游戏里说没权限的时候 —— 先退到标题画面再点。");
    log("  世界开着的时候改会被服务端覆盖，脚本自己会拒绝，不会坏档。");
    log("");
  }

  const picked = pickGameDir();
  if (!picked) {
    if (AUTO) {
      log("  · 没找到存档目录，op 跳过（不影响玩）");
      return 0;
    }
    log("  ✗ 找不到装着存档的 Minecraft 目录。加个参数指定：");
    log('     bun run op:bot --game "E:\\<你的PCL目录>\\.minecraft\\versions\\1.20.6"');
    log("     （下次可以直接把它写进 .env 的 MC_GAME_DIR，就不用再指定了）");
    return 1;
  }
  const gameDir = picked.dir;
  if (!AUTO) log("  游戏目录：" + gameDir + "  [" + picked.how + "]");

  const worlds = listWorlds(gameDir);
  if (worlds.length === 0) {
    if (AUTO) {
      log("  · 这个目录里没有存档，op 跳过（不影响玩）");
      return 0;
    }
    log("  ✗ 这个目录里没有存档（saves/*/level.dat）。");
    return 1;
  }

  const want = value("world");
  const world = want ? worlds.find((w) => w.name === want) : worlds[0];
  if (!world) {
    log("  ✗ 没有叫「" + want + "」的存档。现有：" + worlds.map((w) => w.name).join(" / "));
    return 1;
  }
  if (!AUTO) log("  存档：" + world.name + (want ? "" : "（最近玩过的那个）"));

  const { uuid, from } = readUuid(gameDir, world.dir);
  if (!AUTO) log("  UUID：" + uuid + "（" + from + "）");

  const opsPath = join(world.dir, "ops.json");
  const before = existsSync(opsPath) ? readFileSync(opsPath, "utf8") : null;
  if (before && before.includes(uuid)) {
    if (AUTO) {
      log("  · op 已经准备好了（" + world.name + "）");
      return 0;
    }
    log("");
    log("  ✓ 已经是 op 了，什么都不用做。进游戏「对局域网开放」就行。");
    log("");
    return 0;
  }

  // 唯一真正要判断的事：世界是不是正被游戏加载着（那样写了会被覆盖）。
  if (!FORCE && isWorldLoaded(world.dir)) {
    if (AUTO) {
      log("  · 世界正开着，这次跳过 op（不影响玩：#back 瞬移本来就够用）");
      return 0;
    }
    log("");
    log("  ✗ 世界正开着（你人在存档里）—— 现在改会被服务端覆盖（档不会坏，就是白改）。");
    log("     退到标题画面再跑一次就行；确认已退出就加 --force。");
    log("");
    return 2;
  }

  const after = mergeOpsFile(before, opsEntry(BOT, uuid));
  if (DRY) {
    log("");
    log("  --dry：没有落盘。会写进 " + opsPath);
    log(after.replace(/^/gm, "    "));
    return 0;
  }

  writeFileSync(opsPath, after, "utf8");
  if (AUTO) {
    log("  · 已经把 " + BOT + " 写进 op（存档：" + world.name + "）—— 这次进世界直接就是 op");
    return 0;
  }
  log("  写入：" + opsPath);
  log("");
  log("  ✓ 完成。进游戏「对局域网开放」，" + BOT + " 就有 op 了：");
  log("     #back 秒传送 · 超过 30 格自己抄近路 · 服务器指令（/time /weather /give）也能用");
  log("");
  return 0;
}

process.exit(main());
