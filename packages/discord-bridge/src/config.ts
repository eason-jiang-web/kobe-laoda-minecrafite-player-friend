/** Typed env config for the itto voice bridge. Fails loud on missing required. */

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name} (see .env.example)`);
  return v;
}

export interface VoiceConfig {
  discord: {
    token: string;
    guildId: string;
    voiceChannelId: string;
  };
  elevenlabs: {
    apiKey: string;
    agentId: string;
    /** LLM the agent runs (configurable; see create-agent). */
    llm: string;
    voiceId: string;
  };
  /** itto-mc MCP server (the Minecraft bot) — for control + live context. */
  mcpUrl: string;
  /** how often to poll MC state for context pushes (ms). */
  contextPollMs: number;
  /**
   * The brain (jabby). Voice transcripts are forwarded here so jabby has full
   * context + memory and owns in-world actions. Same BRAIN_* env as the mc-bot.
   * Empty cmd = forwarding off (ElevenLabs handles voice solo).
   */
  brain: {
    cmd: string[];
    dir?: string;
    cooldownMs: number;
  };
  logLevel: string;
}

export function loadVoiceConfig(): VoiceConfig {
  return {
    discord: {
      token: req("ITTO_DISCORD_TOKEN"),
      guildId: req("DISCORD_GUILD_ID"),
      voiceChannelId: req("DISCORD_VOICE_CHANNEL_ID"),
    },
    elevenlabs: {
      apiKey: req("ELEVENLABS_API_KEY"),
      agentId: req("ELEVENLABS_AGENT_ID"),
      llm: process.env.ELEVENLABS_LLM ?? "gemini-2.5-flash",
      voiceId: process.env.ELEVENLABS_VOICE_ID ?? "pNInz6obpgDQGcFmaJgB",
    },
    mcpUrl: process.env.ITTO_MCP_URL ?? "http://localhost:3001/mcp",
    contextPollMs: Number(process.env.VOICE_CONTEXT_POLL_MS ?? 5000),
    brain: {
      cmd: (process.env.BRAIN_CMD ?? "").split(" ").filter(Boolean),
      dir: process.env.BRAIN_DIR || undefined,
      cooldownMs: Number(process.env.BRAIN_COOLDOWN_MS ?? 10000),
    },
    logLevel: process.env.LOG_LEVEL ?? "info",
  };
}
