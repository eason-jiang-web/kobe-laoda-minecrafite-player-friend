/**
 * The absolute minimum mineflayer bot — "hello world" for the body.
 * No framework, no MCP, no loops. Just: connect, log what happens, follow.
 *
 * Run from the REPO ROOT (so Bun loads the root .env):
 *   bun run hello
 *
 * It reads config from .env. For Minehut that's MC_AUTH=microsoft +
 * MC_SERVER_HOST=<name>.minehut.gg + MC_VERSION=1.20.6 + MC_OWNER_USERNAME=<you>.
 * First run prints a microsoft.com/link code to sign the bot's account in
 * (use the BOT's account, not yours). The server must be AWAKE — Minehut
 * free servers sleep when idle, so join it yourself first to wake it.
 */
import mineflayer from "mineflayer";
import { assertSupportedVersion } from "../src/bot/versions.js";

const auth = (process.env.MC_AUTH ?? "offline") as "offline" | "microsoft";

assertSupportedVersion(process.env.MC_VERSION ?? "1.20.6");

const bot = mineflayer.createBot({
  host: process.env.MC_SERVER_HOST ?? "localhost",
  port: Number(process.env.MC_SERVER_PORT ?? 25565),
  username: process.env.MC_BOT_USERNAME ?? "bot",
  auth,
  version: process.env.MC_VERSION ?? "1.20.6",
  // microsoft auth: print the device-code link instead of opening a browser
  onMsaCode: (data) => console.log(`🔑 sign in: ${data.verification_uri} code ${data.user_code}`),
});

const owner = process.env.MC_OWNER_USERNAME ?? "";

bot.once("spawn", () => {
  console.log(`✅ spawned in the world as "${bot.username}"`);
  bot.chat("yo i'm in");
  console.log(`   players online: ${Object.keys(bot.players).join(", ") || "(just me)"}`);

  // crudest possible "follow": every second, walk toward the owner.
  setInterval(() => {
    const target = owner ? bot.players[owner]?.entity : undefined;
    if (!target) return;
    bot.lookAt(target.position.offset(0, 1.6, 0));
    const dist = bot.entity.position.distanceTo(target.position);
    bot.setControlState("forward", dist > 3);
  }, 1000);
});

bot.on("chat", (username, message) => {
  if (username === bot.username) return;
  console.log(`💬 ${username}: ${message}`);
  if (message === "come") bot.chat("omw");
});

bot.on("kicked", (reason) => console.log("❌ kicked:", reason));
bot.on("error", (err) => console.log("❌ error:", err.message));
bot.on("end", () => console.log("🔌 disconnected"));
