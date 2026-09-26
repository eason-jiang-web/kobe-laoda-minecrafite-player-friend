/**
 * 让牢大在游戏里说话 —— 接 Simple Voice Chat。
 *
 * 用的是 vendor 进来的 mineflayer-simplevoice（见 apps/mc-bot/vendor/…/VENDORED.md）：
 * 它说 SVC 的 UDP 协议，机器人就是一个**真正的语音频道成员**，
 * 声音从它在游戏里的位置按距离传出去 —— 和你说话的方式一模一样。
 *
 * 关键选择：走 `sendPCM` 而不是 `sendAudio`。
 * 后者内部用 ffmpeg 转码，实测 5.9 秒音频要 7.5 秒（0.85 倍实时），对话会卡死；
 * 而我们自己合成时格式就是语音模组要的（48k/单声道/16-bit），
 * 解析一下 WAV 头直接发就行，实测 5.9 秒音频编 opus 只要 0.3 秒。
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Bot } from "mineflayer";
// 静态 import（不是 await import）：插件得在 `login` 之前同步挂上，
// 动态 import 会晚一拍，那一拍在慢一点的机器上就够错过 login 了。
import simplevoice from "../../vendor/mineflayer-simplevoice/lib/index.js";
import { logger } from "../util/logger.js";
import { recognize } from "./stt.js";
import { cleanup, synthesize, type TtsOptions } from "./tts.js";
import { isVoiceFormat, parseWav, writeWav } from "./wav.js";

const log = logger("voice");

/**
 * 语音排查日志。
 *
 * 为什么要有它：机器人跑在**你自己的窗口**里，我看不到它的 stdout；
 * 而"你说话它没反应"这种事，看终端和靠你复述都太慢。
 * 所以关键事件同时写一份到 data/voice-debug.log —— 我可以直接读这个文件判断
 * 声音到底有没有送到它这儿（0 个包 = 卡在语音频道/麦克风，有包但认不出名字 = 卡在名字匹配）。
 */
function debugLine(line: string): void {
  try {
    mkdirSync("data", { recursive: true });
    appendFileSync(
      "data/voice-debug.log",
      new Date().toISOString() + " pid=" + process.pid + " " + line + "\n",
      "utf8",
    );
  } catch {
    // 调试日志写不了无所谓，绝不能因此影响说话/听话
  }
}

/** 插件是 CJS：默认导出 `{ plugin, setLoggingLevel }`。 */
interface VoicePlugin {
  plugin(bot: unknown): void;
  setLoggingLevel?(level: number): void;
}
interface VoiceBot {
  voicechat?: {
    isConnected(): boolean;
    sendPCM(pcm: Buffer): Promise<void>;
    /** 插件自己维护的"谁是谁"表（UUID -> 玩家），诊断用。 */
    getPlayers?(): Map<string, { name?: string }>;
  };
}

export interface VoiceChatDeps {
  tts: TtsOptions;
  /** 可注入，测试时替换掉真合成。 */
  speak?: (text: string, opt: TtsOptions) => Promise<{ wavPath: string; dir: string }>;
  /** 可注入，测试时别真加载插件。 */
  loadPlugin?: (bot: unknown) => void;
  /** 只在语音开启时生效：听到的话往哪儿送（通常是"当成玩家在聊天里说的"）。 */
  onHeard?: (text: string, from: string) => void;
  /** 只听谁的（默认主人的名字；留空 = 谁都听）。 */
  listenTo?: string;
  /** 可注入，测试时替换掉真识别。 */
  recognize?: (pcm: Buffer) => Promise<string>;
}

/**
 * 超过这么多字就不念了，只留在聊天里。
 * #help 的清单、#value 的报表都是长句 —— 念出来又长又听不懂，
 * 而聊天栏里一眼就能看完。
 */
export const MAX_SPEAK_CHARS = 120;

/** 多久没新音频就算"这句话说完了"。 */
export const SILENCE_MS = 800;
/** 太短（咳嗽、键盘声）不值得识别；太长（忘了关麦）也别送去识别。 */
export const MIN_UTTERANCE_SECONDS = 0.4;
export const MAX_UTTERANCE_SECONDS = 20;
/** 单个说话人最多缓冲多少字节（防内存涨爆）：48k*2 = 96KB/秒。 */
const MAX_BUFFER_BYTES = 48000 * 2 * (MAX_UTTERANCE_SECONDS + 2);

/** 插件 `voicechat_player_sound` 事件给的东西。 */
interface PlayerSound {
  sender?: string;
  data: Buffer;
  /** 每个包一个递增序号 —— 用来挡掉重复投递（插件可能注册多份回调）。 */
  sequenceNumber?: bigint;
  /** 说话人离机器人多远（格）。 */
  distance?: number;
  whispering?: boolean;
}

export class VoiceChat {
  /** 挂上插件之后才有值（见 attachTo）。 */
  private bot: Bot | null = null;
  private readonly tts: TtsOptions;
  private readonly doSynth: NonNullable<VoiceChatDeps["speak"]>;
  private readonly load: (bot: unknown) => void;
  private readonly onHeard: VoiceChatDeps["onHeard"];
  private readonly listenTo: string;
  private readonly doRecognize: (pcm: Buffer) => Promise<string>;
  private ready = false;
  /** 按说话人攒音频，等他说完再一次性识别。 */
  private readonly buffers = new Map<
    string,
    { chunks: Buffer[]; bytes: number; timer: NodeJS.Timeout | null; lastSeq?: bigint }
  >();
  private heard = 0;
  /** 收到的音频包总数（0 = 你的声音根本没到它这儿）。 */
  private soundPackets = 0;
  private lastConnectLog = 0;
  /** 串行化：插件同一时刻只允许一条音频流。 */
  private chain: Promise<void> = Promise.resolve();
  private spoken = 0;

  constructor(deps: VoiceChatDeps) {
    this.tts = deps.tts;
    this.doSynth = deps.speak ?? synthesize;
    this.load = deps.loadPlugin ?? ((b: unknown) => void attachPlugin(b));
    this.onHeard = deps.onHeard;
    this.listenTo = (deps.listenTo ?? "").trim().toLowerCase();
    this.doRecognize = deps.recognize ?? ((pcm) => recognize(pcm, { culture: "zh-CN" }));
  }

  /**
   * 把语音插件挂到机器人上。
   *
   * **必须在 `login` 之前调用**（createBot 的 onBotCreated 钩子就是这样给的）：
   * 插件在 login 事件里注册 `voicechat:*` 通道，晚一步就永远收不到语音密钥。
   */
  attachTo(bot: Bot): void {
    this.bot = bot;
    this.ready = false;
    this.bind(bot);
    log.info("语音插件已挂上（进世界后会自动连语音服务器）");
  }

  /** 兼容旧名字：重连换了 bot 对象，重新挂一次。 */
  rebind(bot: Bot): void {
    this.attachTo(bot);
  }

  private bind(bot: Bot): void {
    // 挂载失败必须响 —— 之前是 void 丢掉的，结果"没声音"一点线索都没有。
    try {
      this.load(bot);
    } catch (e) {
      log.error("语音插件挂载失败：" + (e as Error).message);
      return;
    }
    bot.on("voicechat_connect" as never, (() => {
      const first = !this.ready;
      this.ready = true;
      // 插件会把这个事件重复发（实测 1 秒内好几次），只在"第一次"和偶尔打日志，
      // 否则终端和调试文件都会刷屏。
      const now = Date.now();
      if (!first && now - this.lastConnectLog < 10000) return;
      this.lastConnectLog = now;
      log.info("语音频道已连上 —— 它现在能说话了");
      debugLine("voicechat_connect");
      // 把"频道里都有谁"打出来：如果这里是空的，说明它认不出说话人是谁 ——
      // 那"收不到"就出在名字匹配上（代码里已经兜住了：认不出也照收）。
      const players = (bot as unknown as VoiceBot).voicechat?.getPlayers?.();
      const names = players ? [...players.values()].map((p) => p.name ?? "?") : [];
      log.info("语音频道成员（" + names.length + "）：" + (names.join(", ") || "（空的）"));
      debugLine("roster(" + names.length + "): " + names.join(", "));
    }) as never);
    // 注意：插件**不会**发 voicechat_disconnect（源码里只有 connect / player_sound 等）。
    // 所以断线靠 isReady() 里那次 isConnected() 判断 —— 插件内部在 socket close 时
    // 会把 connected 置 false。这里挂一个只是为了万一以后上游加了这个事件。
    bot.on("voicechat_disconnect" as never, (() => {
      this.ready = false;
      log.warn("语音频道断了（世界关了？）");
    }) as never);

    // 耳朵：服务端把附近玩家的语音转给我们（已经解成 PCM）。
    bot.on("voicechat_player_sound" as never, ((pkt: PlayerSound) => this.onSound(pkt)) as never);
  }

  /**
   * 收到一小段音频（20ms 一帧）。攒起来，等到没人说话了再整句识别。
   * 只处理主人的声音 —— 别把别人（或者环境音）也当成在跟它说话。
   */
  private onSound(pkt: PlayerSound): void {
    const from = (pkt.sender ?? "").trim();
    if (!pkt.data || pkt.data.length === 0) {
      // 解码失败的保护路径（插件里包了一层 try/catch）—— 记下来别静默
      if (this.soundPackets < 5) log.warn("收到一个解不出来的音频包（sender=" + (from || "?") + "）");
      return;
    }

    this.soundPackets++;
    if (this.soundPackets <= 20 || this.soundPackets % 200 === 0) {
      debugLine(
        "packet #" + this.soundPackets + " sender=" + (from || "(unknown)") +
          " bytes=" + pkt.data.length + " dist=" + (pkt.distance ?? "?"),
      );
    }
    // 前几条逐条打，之后每 100 条汇总 —— 用来判断"声音到底有没有到它这儿"
    if (this.soundPackets <= 5) {
      log.info(
        "收到音频包 #" + this.soundPackets + "：说话人=" + (from || "（插件没认出来是谁）") +
          " 大小=" + pkt.data.length + "B",
      );
    } else if (this.soundPackets % 100 === 0) {
      log.info("已收到 " + this.soundPackets + " 个音频包（在持续收音）");
    }

    // 名字认不出来也收：这个局域网世界里只有你和它，能收到的多半就是你。
    // （原来这里是直接丢掉，所以"听不到"连一行日志都没有。）
    if (from.length === 0 && this.soundPackets === 1) {
      log.warn("插件没解析出说话人名字 —— 先按你来处理；如果听到别人说话再告诉我");
    }
    if (from.length > 0 && this.listenTo.length > 0 && from.toLowerCase() !== this.listenTo) return;

    const who = from.length > 0 ? from : this.listenTo || "someone";

    let buf = this.buffers.get(who);
    if (!buf) {
      buf = { chunks: [], bytes: 0, timer: null };
      this.buffers.set(who, buf);
    }
    if (buf.bytes > MAX_BUFFER_BYTES) {
      log.warn(who + " 这段太长了（忘了关麦？），丢掉重来");
      buf.chunks = [];
      buf.bytes = 0;
    }
    // 同一个序号只收一次：插件若重复注册回调，同一帧会来好几遍，
    // 不去重的话音频会被拼重、识别也会重复。
    if (pkt.sequenceNumber !== undefined) {
      if (buf.lastSeq === pkt.sequenceNumber) return;
      buf.lastSeq = pkt.sequenceNumber;
    }
    buf.chunks.push(Buffer.from(pkt.data));
    buf.bytes += pkt.data.length;
    if (buf.timer) clearTimeout(buf.timer);
    buf.timer = setTimeout(() => void this.finish(who), SILENCE_MS);
  }

  /** 一句话说完了：拼起来送去识别，识别出来的文字交给上层当"他说的话"。 */
  private async finish(from: string): Promise<void> {
    const buf = this.buffers.get(from);
    if (!buf) return;
    this.buffers.delete(from);
    if (buf.timer) clearTimeout(buf.timer);

    const pcm = Buffer.concat(buf.chunks);
    const seconds = pcm.length / 2 / 48000;
    if (seconds < MIN_UTTERANCE_SECONDS) {
      log.debug("太短（" + seconds.toFixed(1) + "s），忽略");
      return;
    }
    if (!this.onHeard) return;

    // 电平诊断：把最后一段存下来并算峰值/有效值。
    // 峰值接近 0 = 解出来是静音（解码或音频流有问题）；
    // 有正常峰值但还是识别不出来 = 声音太小/太吵/引擎不行。
    let peak = 0;
    let sumSq = 0;
    const samples = Math.floor(pcm.length / 2);
    for (let i = 0; i < samples; i++) {
      const v = pcm.readInt16LE(i * 2);
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sumSq += v * v;
    }
    const rms = samples > 0 ? Math.round(Math.sqrt(sumSq / samples)) : 0;
    debugLine("levels peak=" + peak + " rms=" + rms + " samples=" + samples);
    try {
      mkdirSync("data", { recursive: true });
      writeFileSync("data/voice-last.wav", writeWav(pcm));
    } catch {
      // 存不下来不影响识别
    }

    log.info("听到 " + from + " 说了 " + seconds.toFixed(1) + " 秒，识别中…");
    debugLine("utterance " + seconds.toFixed(2) + "s -> recognizing");
    const text = await this.doRecognize(pcm);
    debugLine("recognized: " + (text.trim() || "(空)"));
    if (text.trim().length === 0) {
      log.info("没听清（太吵 / 太轻 / 说的太快），当没听见");
      return;
    }
    this.heard++;
    log.info("听成：" + text);
    this.onHeard(text.trim(), from);
  }

  heardCount(): number {
    return this.heard;
  }

  /** 收到过多少个音频包 —— 排查"收不到"时最关键的数字。 */
  soundPacketCount(): number {
    return this.soundPackets;
  }

  isReady(): boolean {
    if (!this.bot) return false;
    return this.ready && (this.bot as unknown as VoiceBot).voicechat?.isConnected() === true;
  }

  spokenCount(): number {
    return this.spoken;
  }

  /**
   * 说一句。没接上频道、或者合成失败都**只记日志不抛** ——
   * 说话是锦上添花，不能因为它把聊天/任务搞挂。
   */
  say(text: string): Promise<void> {
    const line = text.trim().replace(/\s+/g, " ");
    if (line.length === 0) return Promise.resolve();
    if (line.length > MAX_SPEAK_CHARS) {
      log.debug("这句太长（" + line.length + " 字），只发文字不念：" + line.slice(0, 24) + "…");
      return Promise.resolve();
    }

    this.chain = this.chain.then(async () => {
      if (!this.isReady()) {
        log.debug("语音没接上，这句只发文字：" + line.slice(0, 20));
        return;
      }
      let made: { wavPath: string; dir: string } | null = null;
      try {
        made = await this.doSynth(line, this.tts);
        const info = parseWav(readFileSync(made.wavPath));
        if (!isVoiceFormat(info)) {
          log.warn("合成出来的不是 48k/单声道/16bit，这句跳过（避免发噪音）");
          return;
        }
        const vc = this.bot ? (this.bot as unknown as VoiceBot).voicechat : undefined;
        if (!vc) throw new Error("语音插件没挂上（看启动日志里的 error）");
        await vc.sendPCM(info.pcm);
        this.spoken++;
      } catch (e) {
        log.warn("这句没说出来：" + (e as Error).message);
      } finally {
        if (made) cleanup(made);
      }
    });
    return this.chain;
  }
}

/**
 * 真正加载插件（同步；单独抽出来，测试里好替换）。
 * 失败会抛出去，由 attachTo 记成 error 日志 —— 不允许静默失败。
 */
function attachPlugin(bot: unknown): void {
  const mod = simplevoice as unknown as VoicePlugin & { default?: VoicePlugin };
  const plugin = mod.plugin ?? mod.default?.plugin;
  if (typeof plugin !== "function") throw new Error("语音插件没导出 plugin()");
  plugin(bot);
}
