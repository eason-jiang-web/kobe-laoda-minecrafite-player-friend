import type { Bot } from "mineflayer";
import type { Config } from "../config.js";
import { FollowController } from "./follow.js";
import { SafetyReflexes } from "./safety.js";
import { logger } from "../util/logger.js";

const log = logger("fast-loop");

/**
 * The fast loop. Runs at ~FAST_LOOP_HZ (15Hz default), pure code, no I/O,
 * no LLM. This is what makes itto feel alive while Claude is thinking.
 *
 * Each tick: safety reflexes first (they can override), then follow behavior.
 * Latency budget per tick: 50–100ms. If we ever blow that, profile here.
 */
export class FastLoop {
  readonly follow: FollowController;
  private readonly safety: SafetyReflexes;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private bot: Bot,
    private readonly cfg: Config,
  ) {
    this.follow = new FollowController(bot, cfg);
    this.safety = new SafetyReflexes(bot);
  }

  /** Re-point the loop (and its follow + safety) at a fresh connection. */
  rebind(bot: Bot): void {
    this.bot = bot;
    this.follow.rebind(bot);
    this.safety.rebind(bot);
  }

  start(): void {
    const intervalMs = Math.round(1000 / this.cfg.tuning.fastLoopHz);
    this.timer = setInterval(() => this.tick(), intervalMs);
    log.info(`running at ${this.cfg.tuning.fastLoopHz}Hz (${intervalMs}ms/tick)`);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick(): void {
    try {
      const overridden = this.safety.tick();
      if (!overridden) this.follow.tick();
    } catch (e) {
      log.error("tick error", (e as Error).message);
    }
  }

  /** Current follow state, stamped onto the GameState snapshot. */
  followState() {
    return this.follow.getState();
  }
}
