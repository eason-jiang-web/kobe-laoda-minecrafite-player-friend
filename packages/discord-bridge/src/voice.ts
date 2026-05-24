import {
  joinVoiceChannel,
  EndBehaviorType,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  NoSubscriberBehavior,
  entersState,
  VoiceConnectionStatus,
  type VoiceConnection,
  type AudioPlayer,
} from "@discordjs/voice";
import { PassThrough } from "node:stream";
import prism from "prism-media";
import type { Guild } from "discord.js";
import { logger } from "./log.js";

const log = logger("voice");

/**
 * Discord voice: join a channel, receive everyone's mic audio (decoded to
 * 48kHz stereo PCM), and play itto's audio back. We hand all received audio to
 * one callback — v1 is conversational with the whole room (no per-speaker
 * separation).
 */
/** 20ms of 48kHz 16-bit stereo PCM = 48000 * 0.02 * 2ch * 2bytes. */
const FRAME_BYTES = 3840;
const SILENCE = Buffer.alloc(FRAME_BYTES);

export class VoiceHub {
  private connection: VoiceConnection | null = null;
  private readonly player: AudioPlayer = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play },
  });
  private playStream: PassThrough | null = null;
  /** Agent PCM (48k stereo) waiting to be played, drained 20ms at a time. */
  private pending = Buffer.alloc(0);
  private feedTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly onUserAudio: (pcm48Stereo: Buffer) => void) {}

  async join(guild: Guild, channelId: string): Promise<void> {
    const connection = joinVoiceChannel({
      channelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false, // must be able to hear people
      selfMute: false,
      debug: true,
    });
    this.connection = connection;

    // Diagnostics: log every state transition so we can see where it gets stuck.
    connection.on("stateChange", (o, n) => log.info(`voice: ${o.status} -> ${n.status}`));
    connection.on("error", (e) => log.error("voice connection error:", (e as Error).message));
    // Surface only meaningful internals (DAVE handshake, closes, errors); full
    // stream available at LOG_LEVEL=debug.
    connection.on("debug", (m: string) => {
      if (/\[DAVE\]|clos|error|fail|4\d{3}/i.test(m)) log.debug("vdbg:", m.length > 200 ? m.slice(0, 200) : m);
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    } catch (e) {
      log.error(`voice never reached Ready (stuck at "${connection.state.status}") — ${(e as Error).message}`);
      log.error(
        "likely one of: bot lacks Connect/Speak in THAT channel, wrong channel id, or @discordjs/voice UDP/encryption under Bun",
      );
      connection.destroy();
      throw e;
    }

    connection.subscribe(this.player);
    this.startPlayback();
    this.listen(connection);
    log.info(`✅ joined voice channel ${channelId}`);
  }

  /** Queue agent audio (48kHz stereo PCM) for playback. */
  play(pcm48Stereo: Buffer): void {
    this.pending = Buffer.concat([this.pending, pcm48Stereo]);
  }

  /** Drop queued agent audio (on interruption / barge-in). Keeps the stream alive. */
  flush(): void {
    this.pending = Buffer.alloc(0);
  }

  leave(): void {
    if (this.feedTimer) clearInterval(this.feedTimer);
    this.feedTimer = null;
    this.connection?.destroy();
    this.connection = null;
  }

  // ── internals ──

  private listen(connection: VoiceConnection): void {
    const receiver = connection.receiver;
    const active = new Set<string>();

    receiver.speaking.on("start", (userId) => {
      if (active.has(userId)) return;
      active.add(userId);
      log.info(`🎤 hearing ${userId}`);

      const opus = receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 200 },
      });
      const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
      opus.pipe(decoder);
      let frames = 0;
      decoder.on("data", (chunk: Buffer) => {
        if (frames === 0) log.info(`  ↳ decoding ${userId}'s audio`);
        frames++;
        this.onUserAudio(chunk);
      });

      const cleanup = () => {
        active.delete(userId);
        log.debug(`stopped hearing ${userId} (${frames} frames)`);
      };
      opus.on("end", cleanup);
      opus.on("close", cleanup);
      decoder.on("error", (e) => {
        log.warn(`decode error from ${userId}: ${(e as Error).message}`);
        cleanup();
      });
    });
    log.info("listening for voice (speak in the channel to test receive)");
  }

  private startPlayback(): void {
    // One long-lived Raw PCM stream. A 20ms clock writes either queued agent
    // audio or silence — so the stream never underruns and the player never goes
    // idle (which was dropping every utterance after the first).
    this.playStream = new PassThrough({ highWaterMark: FRAME_BYTES * 16 });
    const resource = createAudioResource(this.playStream, { inputType: StreamType.Raw });
    this.player.play(resource);
    for (let i = 0; i < 3; i++) this.playStream.write(SILENCE); // ~60ms cushion vs timer drift

    if (this.feedTimer) clearInterval(this.feedTimer);
    this.feedTimer = setInterval(() => {
      if (!this.playStream) return;
      let frame: Buffer;
      if (this.pending.length >= FRAME_BYTES) {
        frame = this.pending.subarray(0, FRAME_BYTES);
        this.pending = this.pending.subarray(FRAME_BYTES);
      } else if (this.pending.length > 0) {
        frame = Buffer.concat([this.pending, SILENCE.subarray(this.pending.length)]);
        this.pending = Buffer.alloc(0);
      } else {
        frame = SILENCE;
      }
      this.playStream.write(frame);
    }, 20);
  }
}
