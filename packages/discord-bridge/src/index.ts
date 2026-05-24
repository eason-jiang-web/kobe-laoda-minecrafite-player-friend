import "./opus-patch.js"; // MUST be first: forces opusscript over the crashing native opus
import { Client, GatewayIntentBits } from "discord.js";
import { loadVoiceConfig } from "./config.js";
import { Bridge } from "./bridge.js";
import { logger } from "./log.js";

const log = logger("main");

/**
 * itto's voice presence: a dedicated Discord bot that joins a voice channel and
 * bridges it to an ElevenLabs Conversational AI agent (which can drive the
 * Minecraft bot via itto-mc). Runs as its own process, separate from the mc-bot.
 *
 *   bun run voice           # from repo root (loads .env)
 */
async function main() {
  const cfg = loadVoiceConfig();
  // voice encryption (sodium-native) is loaded lazily by @discordjs/voice on join.

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  const bridge = new Bridge(cfg);

  // Don't let a voice-connection error take down the whole process.
  client.on("error", (e) => log.error("discord client error:", e.message));

  client.once("ready", async () => {
    log.info(`logged in as ${client.user?.tag}`);
    try {
      const guild = await client.guilds.fetch(cfg.discord.guildId);
      await bridge.start(guild);
      log.info("itto voice is up — join the call and talk to it");
    } catch (e) {
      log.error("voice startup failed:", (e as Error).message);
    }
  });

  const shutdown = () => {
    log.info("shutting down…");
    bridge.stop();
    client.destroy();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await client.login(cfg.discord.token);
}

main().catch((e) => {
  log.error("fatal:", e);
  process.exit(1);
});
