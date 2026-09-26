import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Bot } from "mineflayer";
import { SILENCE_MS, VoiceChat } from "./svc.js";

/** 造一个 48k 单声道 WAV 文件，返回路径和它的 PCM。 */
function tempWav(opts: { rate?: number; channels?: number } = {}): { path: string; dir: string; pcm: Buffer } {
  const rate = opts.rate ?? 48000;
  const channels = opts.channels ?? 1;
  const samples = 480; // 10ms
  const dataSize = samples * channels * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * channels * 2, 28);
  buf.writeUInt16LE(channels * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples * channels; i++) buf.writeInt16LE(i, 44 + i * 2);
  const dir = mkdtempSync(join(tmpdir(), "itto-voice-test-"));
  const path = join(dir, "say.wav");
  writeFileSync(path, buf);
  return { path, dir, pcm: buf.subarray(44) };
}

function harness(opts: { connected?: boolean; wav?: { path: string; dir: string; pcm: Buffer } } = {}) {
  const sent: Buffer[] = [];
  const bot = new EventEmitter() as unknown as Bot & EventEmitter;
  const connected = opts.connected ?? true;
  const wav = opts.wav ?? tempWav();

  const voice = new VoiceChat({
    tts: { voice: "test", rate: 0 },
    // 不真加载插件，也不真合成
    loadPlugin: (b) => {
      (b as unknown as { voicechat: unknown }).voicechat = {
        isConnected: () => connected,
        sendPCM: async (pcm: Buffer) => {
          sent.push(pcm);
        },
      };
    },
    // 默认每次合成给一个新文件（真实实现每句一个临时目录，说完就删）；
    // 想让某条用例喂特定格式，就用 opts.wav 指定。
    speak: async () => {
      const chosen = opts.wav ?? tempWav();
      return { wavPath: chosen.path, dir: chosen.dir };
    },
  });
  voice.attachTo(bot);
  return { bot, voice, sent, wav };
}

/** 造一小段 48k 单声道 PCM（默认 1 秒）。 */
function pcmOf(seconds: number): Buffer {
  return Buffer.alloc(Math.round(seconds * 48000) * 2);
}

function earHarness(opts: { listenTo?: string } = {}) {
  const bot = new EventEmitter() as unknown as Bot & EventEmitter;
  const heard: Array<{ text: string; from: string }> = [];
  const recognized: Buffer[] = [];

  const voice = new VoiceChat({
    tts: { voice: "test", rate: 0 },
    loadPlugin: (b) => {
      (b as unknown as { voicechat: unknown }).voicechat = {
        isConnected: () => true,
        sendPCM: async () => {},
      };
    },
    speak: async () => ({ wavPath: "unused", dir: "unused" }),
    listenTo: opts.listenTo ?? "eason",
    onHeard: (text, from) => heard.push({ text, from }),
    recognize: async (pcm) => {
      recognized.push(pcm);
      return "挖点铁回来";
    },
  });

  /** 模拟服务端转来一段语音（默认 1 秒，分帧送来）。 */
  const speak = (sender: string, seconds = 1) => {
    const pcm = pcmOf(seconds);
    for (let off = 0; off < pcm.length; off += 1920) {
      bot.emit("voicechat_player_sound", { sender, data: pcm.subarray(off, off + 1920) });
    }
  };

  voice.attachTo(bot);
  return { bot, voice, heard, recognized, speak };
}

describe("VoiceChat — 听你说话", () => {
  test("说完了就识别，识别结果当'他说的话'送出去", async () => {
    const h = earHarness();
    h.speak("eason", 1);
    await new Promise((r) => setTimeout(r, SILENCE_MS + 400));
    expect(h.heard).toEqual([{ text: "挖点铁回来", from: "eason" }]);
    expect(h.voice.heardCount()).toBe(1);
    // 送进识别的是拼起来的完整音频，不是一帧
    expect(h.recognized[0]!.length).toBe(48000 * 2);
  });

  test("插件没解析出说话人时也收（否则'收不到'会毫无线索）", async () => {
    const h = earHarness();
    const pcm = pcmOf(1);
    for (let off = 0; off < pcm.length; off += 1920) {
      h.bot.emit("voicechat_player_sound", { data: pcm.subarray(off, off + 1920) });
    }
    await new Promise((r) => setTimeout(r, SILENCE_MS + 400));
    expect(h.voice.soundPacketCount()).toBeGreaterThan(0);
    expect(h.heard.length).toBe(1);
  });

  test("同一个包重复到达（插件重复注册回调那种）不会识别两遍", async () => {
    const h = earHarness();
    const pcm = pcmOf(1);
    // 同一帧连着送两次，并且带上 sequenceNumber（真实包里有）
    let seq = 0;
    for (let off = 0; off < pcm.length; off += 1920) {
      const frame = pcm.subarray(off, off + 1920);
      h.bot.emit("voicechat_player_sound", { sender: "eason", data: frame, sequenceNumber: BigInt(seq) });
      h.bot.emit("voicechat_player_sound", { sender: "eason", data: frame, sequenceNumber: BigInt(seq) });
      seq++;
    }
    await new Promise((r) => setTimeout(r, SILENCE_MS + 400));
    // 识别只发生一次，而且送进去的音频长度还是 1 秒（没被拼成 2 秒）
    expect(h.recognized.length).toBe(1);
    expect(h.recognized[0]!.length).toBe(48000 * 2);
  });

  test("别人的声音不听（只听主人的）", async () => {
    const h = earHarness({ listenTo: "eason" });
    h.speak("steve", 1);
    await new Promise((r) => setTimeout(r, SILENCE_MS + 400));
    expect(h.heard.length).toBe(0);
    expect(h.recognized.length).toBe(0);
  });

  test("太短的不送去识别（咳嗽、键盘声）", async () => {
    const h = earHarness();
    h.speak("eason", 0.1);
    await new Promise((r) => setTimeout(r, SILENCE_MS + 400));
    expect(h.recognized.length).toBe(0);
  });

  test("没识别出内容就不当成说话", async () => {
    const bot = new EventEmitter() as unknown as Bot & EventEmitter;
    const heard: string[] = [];
    const vc = new VoiceChat({
      tts: { voice: "test", rate: 0 },
      loadPlugin: () => {},
      listenTo: "eason",
      onHeard: (t) => heard.push(t),
      recognize: async () => "   ",
    });
    vc.attachTo(bot);
    for (let off = 0; off < pcmOf(1).length; off += 1920) {
      bot.emit("voicechat_player_sound", { sender: "eason", data: pcmOf(1).subarray(off, off + 1920) });
    }
    await new Promise((r) => setTimeout(r, SILENCE_MS + 400));
    expect(heard.length).toBe(0);
  });
});

describe("VoiceChat — 在游戏里说话", () => {
  test("接上频道前不说话，接上之后才发", async () => {
    const h = harness();
    expect(h.voice.isReady()).toBe(false);
    await h.voice.say("这句应该被丢掉");
    expect(h.sent.length).toBe(0);

    h.bot.emit("voicechat_connect");
    expect(h.voice.isReady()).toBe(true);
    await h.voice.say("到，兄弟。");
    expect(h.sent.length).toBe(1);
    expect(h.voice.spokenCount()).toBe(1);
  });

  test("发出去的是 WAV 里那段纯 PCM", async () => {
    const h = harness();
    h.bot.emit("voicechat_connect");
    await h.voice.say("你好");
    expect(h.sent[0]!.equals(h.wav.pcm)).toBe(true);
  });

  test("格式不对（比如 44.1k）就不发，免得在他耳朵里放噪音", async () => {
    const bad = tempWav({ rate: 44100 });
    const h = harness({ wav: bad });
    h.bot.emit("voicechat_connect");
    await h.voice.say("这句不该发出去");
    expect(h.sent.length).toBe(0);
  });

  test("多句排队，一句都不丢（插件同一时刻只允许一条流）", async () => {
    const h = harness();
    h.bot.emit("voicechat_connect");
    await Promise.all([h.voice.say("第一句"), h.voice.say("第二句"), h.voice.say("第三句")]);
    expect(h.sent.length).toBe(3);
    expect(h.voice.spokenCount()).toBe(3);
  });

  test("断开后闭嘴", async () => {
    const h = harness();
    h.bot.emit("voicechat_connect");
    h.bot.emit("voicechat_disconnect");
    await h.voice.say("断了就别说了");
    expect(h.sent.length).toBe(0);
  });

  test("太长的清单只发文字、不念出来", async () => {
    const h = harness();
    h.bot.emit("voicechat_connect");
    await h.voice.say("#back · #free · ".repeat(20));
    expect(h.sent.length).toBe(0);
  });

  test("空字符串不浪费一次合成", async () => {
    const h = harness();
    h.bot.emit("voicechat_connect");
    await h.voice.say("   ");
    expect(h.sent.length).toBe(0);
  });

  test("重连之后跟着新 bot 走", async () => {
    const h = harness();
    const bot2 = new EventEmitter() as unknown as Bot & EventEmitter;
    h.voice.rebind(bot2);
    expect(h.voice.isReady()).toBe(false);
    bot2.emit("voicechat_connect");
    expect(h.voice.isReady()).toBe(true);
  });
});
