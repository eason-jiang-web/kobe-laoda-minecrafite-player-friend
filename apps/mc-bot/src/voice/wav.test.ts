import { describe, expect, test } from "bun:test";
import { isVoiceFormat, parseWav, writeWav, VOICE_FORMAT } from "./wav.js";

/** 造一个最小 WAV（PCM）。 */
function makeWav(opts: { rate?: number; channels?: number; bits?: number; format?: number; samples?: number } = {}): Buffer {
  const rate = opts.rate ?? 48000;
  const channels = opts.channels ?? 1;
  const bits = opts.bits ?? 16;
  const format = opts.format ?? 1;
  const samples = opts.samples ?? 960;
  const dataSize = samples * channels * (bits / 8);
  const buf = Buffer.alloc(44 + dataSize);

  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(format, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE((rate * channels * bits) / 8, 28);
  buf.writeUInt16LE((channels * bits) / 8, 32);
  buf.writeUInt16LE(bits, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples; i++) buf.writeInt16LE(i % 100, 44 + i * 2);
  return buf;
}

describe("parseWav", () => {
  test("读出格式和 PCM 数据", () => {
    const info = parseWav(makeWav({ samples: 100 }));
    expect(info.sampleRate).toBe(48000);
    expect(info.channels).toBe(1);
    expect(info.bitsPerSample).toBe(16);
    expect(info.pcm.length).toBe(200);
    expect(info.pcm.readInt16LE(0)).toBe(0);
  });

  test("44.1k 立体声也认（只是格式不对，不能直接发）", () => {
    const info = parseWav(makeWav({ rate: 44100, channels: 2 }));
    expect(info.sampleRate).toBe(44100);
    expect(isVoiceFormat(info)).toBe(false);
    expect(isVoiceFormat(parseWav(makeWav()))).toBe(true);
  });

  test("不是 WAV 就抛错（宁可退回转码，也不发噪音）", () => {
    expect(() => parseWav(Buffer.from("这不是音频"))).toThrow(/WAV/);
    expect(() => parseWav(Buffer.alloc(100))).toThrow(/WAV/);
  });

  test("压缩格式（非 PCM）拒绝", () => {
    expect(() => parseWav(makeWav({ format: 3 }))).toThrow(/PCM/);
  });

  test("语音模组要的格式常量", () => {
    expect(VOICE_FORMAT).toEqual({ sampleRate: 48000, channels: 1, bitsPerSample: 16 });
  });

  test("writeWav 包出来的东西能被 parseWav 读回来（给识别引擎用）", () => {
    const pcm = Buffer.alloc(960 * 2);
    for (let i = 0; i < 960; i++) pcm.writeInt16LE(i, i * 2);
    const info = parseWav(writeWav(pcm));
    expect(info.sampleRate).toBe(48000);
    expect(info.channels).toBe(1);
    expect(info.bitsPerSample).toBe(16);
    expect(info.pcm.equals(pcm)).toBe(true); // 一个字节都不能差
  });
});
