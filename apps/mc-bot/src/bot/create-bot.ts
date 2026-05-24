import mineflayer, { type Bot } from "mineflayer";
import { pathfinder, Movements } from "mineflayer-pathfinder";
import type { Config } from "../config.js";
import { logger } from "../util/logger.js";

const log = logger("bot");

/**
 * Spawn the Mineflayer bot and wait until it's in the world. Loads the
 * pathfinder plugin and a sane default Movements profile (the fast-loop
 * follow SM tweaks this further).
 */
export function createBot(cfg: Config): Promise<Bot> {
  const bot = mineflayer.createBot({
    host: cfg.mc.host,
    port: cfg.mc.port,
    version: cfg.mc.version,
    username: cfg.mc.username,
    auth: cfg.mc.auth,
  });

  bot.loadPlugin(pathfinder);

  return new Promise((resolve, reject) => {
    // Reject a stalled connect (TCP open but no spawn — e.g. connecting while the
    // server is mid-boot) so the reconnect loop can back off and retry instead
    // of hanging forever on a dead attempt.
    const timer = setTimeout(() => {
      try {
        bot.end();
      } catch {
        /* ignore */
      }
      reject(new Error("connect timed out (no spawn within 30s)"));
    }, 30000);

    bot.once("spawn", () => {
      clearTimeout(timer);
      const movements = new Movements(bot);
      movements.allowSprinting = true;
      movements.canDig = false; // following shouldn't tear up the world; skills opt in
      bot.pathfinder.setMovements(movements);
      log.info(`spawned as ${bot.username} on ${cfg.mc.host}:${cfg.mc.port}`);
      resolve(bot);
    });
    bot.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    bot.once("kicked", (reason) => {
      clearTimeout(timer);
      reject(new Error(`kicked: ${reason}`));
    });
  });
}

/**
 * Wire the "the connection died" events to a single handler, so the boot
 * sequence can drive auto-reconnect. Fires at most once per bot instance.
 */
export function onBotDead(bot: Bot, handler: (reason: string) => void): void {
  let fired = false;
  const fire = (reason: string) => {
    if (fired) return;
    fired = true;
    handler(reason);
  };
  bot.on("error", (e) => log.error("bot error:", e.message));
  bot.once("end", (reason) => fire(`end: ${reason}`));
  bot.once("kicked", (reason) =>
    fire(`kicked: ${typeof reason === "string" ? reason : JSON.stringify(reason)}`),
  );
}
