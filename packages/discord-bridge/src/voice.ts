import {
  joinVoiceChannel,
  EndBehaviorType,
  createAudioPlayer,
  createAudioResource,
  StreamType,
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
export class VoiceHub {
  private connection: VoiceConnection | null = null;
  private readonly player: AudioPlayer = createAudioPlayer();
  private playStream: PassThrough | null = null;

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

  /** Play agent audio (48kHz stereo PCM) into the VC. */
  play(pcm48Stereo: Buffer): void {
    if (!this.playStream) this.startPlayback();
    this.playStream!.write(pcm48Stereo);
  }

  /** Drop any queued agent audio (on interruption / barge-in). */
  flush(): void {
    this.player.stop(true);
    this.playStream?.end();
    this.startPlayback();
  }

  leave(): void {
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

      const opus = receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 200 },
      });
      const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
      opus.pipe(decoder);
      decoder.on("data", (chunk: Buffer) => this.onUserAudio(chunk));

      const cleanup = () => active.delete(userId);
      opus.on("end", cleanup);
      opus.on("close", cleanup);
      decoder.on("error", cleanup);
    });
  }

  private startPlayback(): void {
    this.playStream = new PassThrough();
    const resource = createAudioResource(this.playStream, { inputType: StreamType.Raw });
    this.player.play(resource);
  }
}
