import type { Guild } from "discord.js";
import type { GameState } from "@itto/shared";
import type { VoiceConfig } from "./config.js";
import { ElevenConversation } from "./elevenlabs.js";
import { VoiceHub } from "./voice.js";
import { McClient } from "./mc.js";
import { discordToEleven, elevenToDiscord } from "./audio.js";
import { logger } from "./log.js";

const log = logger("bridge");

/**
 * Ties the three sides together:
 *   Discord VC  ⇄  ElevenLabs agent  ⇄  itto-mc (Minecraft bot)
 *
 *  - mic audio (Discord)  → resample → ElevenLabs
 *  - agent audio (ElevenLabs) → resample → Discord VC
 *  - agent tool calls → itto-mc MCP (say / run_skill / get_state)
 *  - live MC events (new chat, nearby mobs) → contextual updates to the agent
 */
export class Bridge {
  private readonly mc: McClient;
  private eleven: ElevenConversation | null = null;
  private voice: VoiceHub | null = null;
  private prev: GameState | null = null;
  private lastChatAt = 0;
  private lastSeenGoalId: string | null = null;
  private lastBrainAt = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly cfg: VoiceConfig) {
    this.mc = new McClient(cfg.mcpUrl);
  }

  async start(guild: Guild): Promise<void> {
    // Non-fatal: voice should work even if the MC bot isn't up yet. Tools +
    // game context kick in once itto-mc is reachable (the poll reconnects).
    try {
      await this.mc.connect();
    } catch {
      log.warn("itto-mc not reachable yet (is `bun run bot` up?) — voice works; MC tools/context start once it is");
    }

    this.eleven = new ElevenConversation(this.cfg.elevenlabs.apiKey, this.cfg.elevenlabs.agentId, {
      onAudio: (pcmMono, rate) => this.voice?.play(elevenToDiscord(pcmMono, rate)),
      onInterruption: () => this.voice?.flush(),
      onToolCall: (name, id, params) => void this.handleToolCall(name, id, params),
      onUserTranscript: (text) => this.forwardToBrain(text),
      onReady: () => log.info("itto is live in the call"),
      onClose: () => log.warn("ElevenLabs conversation closed"),
    });

    this.voice = new VoiceHub((pcm48) => {
      const el = this.eleven;
      if (el) el.sendAudio(discordToEleven(pcm48, el.userInputRate));
    });

    await this.voice.join(guild, this.cfg.discord.voiceChannelId);
    await this.eleven.start();
    this.startContextPoll();
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.eleven?.close();
    this.voice?.leave();
  }

  // ── agent tool calls → Minecraft bot ──

  private async handleToolCall(name: string, id: string, params: Record<string, unknown>): Promise<void> {
    log.info(`tool: ${name}`, params);
    try {
      switch (name) {
        case "minecraft_say":
          await this.mc.say(String(params.message ?? ""));
          return; // expects_response: false
        case "minecraft_set_goal": {
          // non-blocking: kick off the task, ack immediately. Completion comes
          // back through deriveContext (lastGoal) as a spoken-friendly note.
          const args = parseArgs(params.args);
          const res = await this.mc.setGoal(String(params.task ?? params.skill ?? ""), args);
          this.eleven?.sendToolResult(id, res);
          return;
        }
        case "minecraft_run_skill": {
          // kept for back-compat: route through set_goal so it never blocks.
          const args = parseArgs(params.args);
          const res = await this.mc.setGoal(String(params.skill ?? ""), args);
          this.eleven?.sendToolResult(id, res);
          return;
        }
        case "minecraft_get_state": {
          const res = await this.mc.getStateText();
          this.eleven?.sendToolResult(id, res);
          return;
        }
        default:
          this.eleven?.sendToolResult(id, `unknown tool ${name}`, true);
      }
    } catch (e) {
      this.eleven?.sendToolResult(id, `error: ${(e as Error).message}`, true);
    }
  }

  // ── voice transcripts → the brain (jabby) ──

  /**
   * Hybrid brain split: ElevenLabs handles the live voice (talk + quick
   * reactions), and we forward what people SAY to jabby so it has full context
   * + memory and owns in-world actions (set_goal / skills). Fire-and-forget with
   * a cooldown (each spawn is a full brain turn). No-op if BRAIN_CMD is unset.
   */
  private forwardToBrain(transcript: string): void {
    const { cmd, dir, cooldownMs } = this.cfg.brain;
    if (cmd.length === 0) return; // forwarding disabled
    const now = Date.now();
    if (now - this.lastBrainAt < cooldownMs) return;
    this.lastBrainAt = now;

    const prompt = [
      "You're itto, in a live Minecraft voice call with your friends. The voice layer is handling talking out loud — your job is the HANDS + memory in the Minecraft world.",
      `Someone in the call just said: "${transcript}"`,
      "If they want something done in the world (come, follow, get wood, mine, fight, fetch, scout, build), DO it via the itto-mc tools — prefer set_goal for multi-step tasks. Read itto://state/current and itto://memory/world first for live context. Remember anything useful (locations, what they like). If it's just chit-chat, do nothing — the voice layer's got that.",
    ].join("\n");

    try {
      const proc = Bun.spawn([...cmd, prompt], { cwd: dir, stdout: "ignore", stderr: "pipe" });
      void proc.exited.then(async (code) => {
        if (code !== 0) {
          const err = (await new Response(proc.stderr).text()).slice(0, 200);
          log.warn(`brain exited ${code}: ${err}`);
        }
      });
    } catch (e) {
      log.error("failed to forward to brain:", (e as Error).message);
    }
  }

  // ── live MC events → conversation context ──

  private startContextPoll(): void {
    this.pollTimer = setInterval(async () => {
      try {
        if (!this.mc.connected) await this.mc.connect(); // best-effort reconnect once the bot's up
        const s = await this.mc.getState();
        const ctx = this.deriveContext(s);
        this.prev = s;
        if (ctx) {
          log.debug("context →", ctx);
          this.eleven?.sendContext(ctx);
        }
      } catch {
        /* bot probably offline; ignore until it's back */
      }
    }, this.cfg.contextPollMs);
  }

  /** Turn state deltas into a short, non-spammy context line (or null). */
  private deriveContext(s: GameState): string | null {
    const lines: string[] = [];

    // new Minecraft chat from players (so itto can react to it out loud)
    const newChat = s.recentChat.filter((c) => c.at > this.lastChatAt);
    if (newChat.length) {
      this.lastChatAt = newChat[newChat.length - 1]!.at;
      for (const c of newChat) lines.push(`[minecraft chat] ${c.username}: ${c.message}`);
    }

    // newly-appeared nearby hostiles
    const prevIds = new Set((this.prev?.nearbyHostiles ?? []).map((h) => h.id));
    for (const h of s.nearbyHostiles) {
      if (!prevIds.has(h.id) && h.distance < 12) lines.push(`a ${h.name} just showed up ~${h.distance} blocks away`);
    }

    // a background task (set_goal) just finished — so itto can react out loud
    const lg = s.lastGoal;
    if (lg && lg.id !== this.lastSeenGoalId) {
      this.lastSeenGoalId = lg.id;
      const detail = lg.status === "failed" ? `couldn't ${lg.label}` : `done: ${lg.label}${lg.progress ? ` — ${lg.progress}` : ""}`;
      lines.push(detail);
    }

    return lines.length ? `[game] ${lines.join(" | ")}` : null;
  }
}

function parseArgs(raw: unknown): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    return JSON.parse(String(raw));
  } catch {
    return undefined;
  }
}
