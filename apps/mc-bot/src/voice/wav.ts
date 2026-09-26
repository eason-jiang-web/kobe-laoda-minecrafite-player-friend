/**
 * 从 WAV 里抠出 PCM 数据块。
 *
 * 为什么要自己解析：插件原本用 ffmpeg 转码，实测**转 5.9 秒音频要 7.5 秒**
 * （0.85 倍实时，对话会卡得没法听）。而我们自己合成语音时格式是自己定的
 * （48kHz / 单声道 / 16-bit，正好是语音模组要的），根本不需要转码 ——
 * 读个 44 字节的头就能把 PCM 交出去。
 */
export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  /** 纯 PCM 数据（s16le）。 */
  pcm: Buffer;
}

/**
 * 解析 WAV（只支持 PCM，也就是 format=1）。
 * 认不出来就抛错 —— 上层会退回 ffmpeg 那条慢路，而不是发出去一堆噪音。
 */
export function parseWav(buf: Buffer): WavInfo {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("不是 WAV 文件（缺 RIFF/WAVE 头）");
  }

  let offset = 12;
  let fmt: { sampleRate: number; channels: number; bitsPerSample: number; format: number } | null = null;
  let data: Buffer | null = null;

  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;

    if (id === "fmt ") {
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      data = buf.subarray(body, Math.min(body + size, buf.length));
    }

    offset = body + size + (size % 2); // 块按偶数对齐
  }

  if (!fmt) throw new Error("WAV 里没有 fmt 块");
  if (!data) throw new Error("WAV 里没有 data 块");
  if (fmt.format !== 1) throw new Error("不是未压缩 PCM（format=" + fmt.format + "）");

  return {
    sampleRate: fmt.sampleRate,
    channels: fmt.channels,
    bitsPerSample: fmt.bitsPerSample,
    pcm: data,
  };
}

/**
 * 把纯 PCM 包成一个 WAV 文件（识别引擎只吃文件，不接受裸流）。
 * 格式默认就是语音模组那套（48k/单声道/16bit）。
 */
export function writeWav(pcm: Buffer, format = VOICE_FORMAT): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = (format.sampleRate * format.channels * format.bitsPerSample) / 8;
  const blockAlign = (format.channels * format.bitsPerSample) / 8;

  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(format.channels, 22);
  header.writeUInt32LE(format.sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(format.bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

/** 语音模组要的格式：48kHz / 单声道 / 16-bit。 */
export const VOICE_FORMAT = { sampleRate: 48000, channels: 1, bitsPerSample: 16 } as const;

/** 格式对不对 —— 不对就得转码，不能直接发。 */
export function isVoiceFormat(info: WavInfo): boolean {
  return (
    info.sampleRate === VOICE_FORMAT.sampleRate &&
    info.channels === VOICE_FORMAT.channels &&
    info.bitsPerSample === VOICE_FORMAT.bitsPerSample
  );
}
