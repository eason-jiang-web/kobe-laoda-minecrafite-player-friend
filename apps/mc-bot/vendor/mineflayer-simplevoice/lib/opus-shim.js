"use strict";
/**
 * @discordjs/opus 的替身 —— 只用纯 JS 的 opusscript 实现。
 *
 * 为什么需要它：@discordjs/opus 是原生模块，官方没有 Node 24 的预编译包，
 * 回退源码编译又需要 Visual Studio 构建工具（实测 spawn EINVAL 装不上）。
 * 而 opusscript 是 emscripten 编出来的纯 JS/WASM，任何环境直接可用，
 * 实测 48kHz 单声道：1 秒音频编码 17ms（60 倍实时），完全够语音用。
 *
 * 插件只用到这里两个方法：encode(pcm) 和 decode(opus)（注意它是在 encoder
 * 实例上调解码的），所以这个替身把两个都放在同一个类里。
 */
const OpusScript = require("opusscript");

/** SVC 的帧：20ms @ 48kHz 单声道 = 960 样本。 */
function frameSize(rate, channels) {
  return Math.round((rate / 1000) * 20) * channels;
}

class OpusEncoder {
  constructor(rate, channels) {
    this.rate = rate;
    this.channels = channels;
    this.frame = frameSize(rate, channels);
    this.impl = new OpusScript(rate, channels, OpusScript.Application.AUDIO);
  }

  /**
   * 插件会调它设码率（SVC 用 48kbps）。opusscript 没有这个开关 ——
   * 它的编码器默认就是给语音用的中低码率，实测编出来 5.9 秒音频 27KB ≈ 37kbps，
   * 和 48kbps 一个量级。所以这里留个空实现，把参数记下来供调试。
   */
  setBitrate(bitrate) {
    this.bitrate = bitrate;
  }

  /** pcm Buffer -> opus Buffer */
  encode(pcm) {
    // 第二参数是"帧内样本数"，不传会被当成 0 -> opus Bad argument（实测踩过）
    return this.impl.encode(pcm, pcm.length / 2 / this.channels);
  }

  /** opus Buffer -> pcm Buffer（插件在 encoder 上调解码，所以这里也得有） */
  decode(opus) {
    return this.impl.decode(opus, this.frame);
  }
}

class OpusDecoder extends OpusEncoder {}

module.exports = { OpusEncoder, OpusDecoder };
