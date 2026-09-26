/**
 * 听：把一段 PCM 识别成中文（Windows 自带的中文识别，不联网、不花钱）。
 *
 * 走 `scripts/hear.ps1`：识别结果**写进文件**再读回来 —— 中文过管道很容易变乱码，
 * 这个坑在之前那版语音脚本里踩过。
 *
 * 代价：每句话要多花 1~2 秒（起 PowerShell + 加载引擎 + 识别）。
 * 想让对话更快就得换常驻进程或云端识别，那是下一步的事。
 */
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { logger } from "../util/logger.js";
import { writeWav } from "./wav.js";

const log = logger("hear");
const run = promisify(execFile);

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const HEAR_SCRIPT = join(REPO_ROOT, "scripts", "hear.ps1");

export interface SttOptions {
  /** 识别引擎的语言，默认 zh-CN。 */
  culture: string;
}

/**
 * 一段 48kHz 单声道 PCM -> 文字。识别不出来就返回空字符串（不是错误）。
 */
export async function recognize(pcm: Buffer, opt: SttOptions): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "itto-hear-"));
  const wavPath = join(dir, "heard.wav");
  const outPath = join(dir, "heard.txt");
  writeFileSync(wavPath, writeWav(pcm));

  try {
    const { stdout } = await run(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        HEAR_SCRIPT,
        "-Wav",
        wavPath,
        "-OutFile",
        outPath,
        "-Culture",
        opt.culture,
      ],
      { windowsHide: true, timeout: 30000 },
    );
    const note = String(stdout).trim().split("\n").pop() ?? "";
    const text = readFileSync(outPath, "utf8").trim();
    log.debug("识别：" + (text || "(空)") + "  " + note);
    return text;
  } catch (e) {
    log.warn("识别失败：" + (e as Error).message.slice(0, 120));
    return "";
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // 临时目录删不掉无所谓
    }
  }
}
