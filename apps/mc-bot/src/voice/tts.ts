/**
 * 中文文本 → WAV（Windows 自带的中文语音合成，不联网、不花钱）。
 *
 * 走 `scripts/say.ps1`：文本写进临时文件再读，避免命令行引号把中文/标点搞坏。
 * 输出格式固定 48kHz 单声道 16-bit —— 正好能直接喂给语音模组，跳过 ffmpeg。
 */
import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { logger } from "../util/logger.js";

const log = logger("tts");
const run = promisify(execFile);

/** 仓库根目录（这个文件在 apps/mc-bot/src/voice/ 里）。 */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const SAY_SCRIPT = join(REPO_ROOT, "scripts", "say.ps1");

export interface TtsOptions {
  /** 音色名，比如 Microsoft Huihui Desktop / Microsoft Yaoyao。 */
  voice: string;
  /** 语速 -10..10。 */
  rate: number;
}

export interface Synthesized {
  wavPath: string;
  /** 临时目录，说完记得删。 */
  dir: string;
}

/** 合成一句话到临时 WAV。 */
export async function synthesize(text: string, opt: TtsOptions): Promise<Synthesized> {
  const dir = mkdtempSync(join(tmpdir(), "itto-say-"));
  const textFile = join(dir, "say.txt");
  const wavPath = join(dir, "say.wav");
  writeFileSync(textFile, text, "utf8");

  await run(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      SAY_SCRIPT,
      "-TextFile",
      textFile,
      "-Wav",
      wavPath,
      "-Voice",
      opt.voice,
      "-Rate",
      String(opt.rate),
    ],
    { windowsHide: true, timeout: 30000 },
  );

  const size = statSync(wavPath).size;
  log.debug("合成 " + size + " 字节：" + text.slice(0, 24));
  return { wavPath, dir };
}

/** 用完清理（合成失败时也别把临时文件留在磁盘上）。 */
export function cleanup(s: Synthesized): void {
  try {
    rmSync(s.dir, { recursive: true, force: true });
  } catch {
    // 临时目录删不掉不值得报错
  }
}
