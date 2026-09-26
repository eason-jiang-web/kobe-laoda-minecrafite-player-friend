import mineflayer, { type Bot } from "mineflayer";
import { pathfinder, Movements } from "mineflayer-pathfinder";
import type { Config } from "../config.js";
import { logger } from "../util/logger.js";
import { assertSupportedVersion } from "./versions.js";

const log = logger("bot");

/**
 * Spawn the Mineflayer bot and wait until it's in the world. Loads the
 * pathfinder plugin and a sane default Movements profile (the fast-loop
 * follow SM tweaks this further).
 */
export interface CreateBotOptions {
  /**
   * 机器人对象刚建好、**还没登录**时的钩子。
   *
   * 语音插件必须在这里挂：它是在 `login` 事件里注册语音通道的，
   * 等 spawn 之后再挂就已经错过了 —— 通道没注册，机器人就不请求语音密钥，
   * 结果就是"人在世界里，却永远进不了语音频道"（实测踩过这个坑）。
   */
  onBotCreated?: (bot: Bot) => void;
}

export function createBot(cfg: Config, opts: CreateBotOptions = {}): Promise<Bot> {
  // Fail with something readable instead of a protocol-level stack trace.
  assertSupportedVersion(cfg.mc.version);

  const bot = mineflayer.createBot({
    host: cfg.mc.host,
    port: cfg.mc.port,
    version: cfg.mc.version,
    username: cfg.mc.username,
    auth: cfg.mc.auth,
    // mineflayer 默认(logErrors: true)会给每个 error 自己再 console.log 一遍，
    // 带完整堆栈 —— 连不上时会每隔几秒刷一屏，看着像程序坏了。
    // 我们的日志已经有一行说清原因 + 端口该填多少，所以把这份重复的关掉。
    logErrors: false,
  } as Parameters<typeof mineflayer.createBot>[0]);

  bot.loadPlugin(pathfinder);
  opts.onBotCreated?.(bot);

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
    // 用 on 而不是 once：连不上时 mineflayer 会 emit 不止一次 error，
    // 只挂 once 的话第二次就没人接 —— 运行时会把它连同调用栈整个打出来，
    // 窗口里刷一堆堆栈，看着像程序坏了（实测就是这么刷的）。
    let settled = false;
    bot.on("error", (e) => {
      if (settled) {
        log.debug("extra bot error after the first one: " + e.message);
        return;
      }
      settled = true;
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
