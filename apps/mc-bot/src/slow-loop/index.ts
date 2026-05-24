import type { BotGoal, GameState } from "@itto/shared";
import { formatStateForPrompt } from "@itto/shared";
import type { BotController } from "../bot/controller.js";
import type { Config } from "../config.js";
import type { WorldMemory } from "../memory/store.js";
import type { GoalRunner } from "./goal-runner.js";
import { TRIGGERS, MEMORY_TRIGGERS, VibeCheck } from "./triggers.js";
import { logger } from "../util/logger.js";

const log = logger("slow-loop");

/**
 * A "nudge" is the slow loop telling Claude (via Hermes) that something might
 * be worth a reaction. Hermes ultimately decides whether to speak/act — we
 * just surface opportunities. The actual transport to Hermes is TBD (MCP
 * notification / sampling request / webhook), so we abstract it.
 */
export interface NudgeSink {
  nudge(reason: string, state: GameState): void | Promise<void>;
}

/** Default sink: just logs. Swap for the Hermes bridge once wired. */
export const consoleNudgeSink: NudgeSink = {
  nudge(reason, state) {
    log.info(`NUDGE [${reason}]\n${formatStateForPrompt(state)}`);
  },
};

/**
 * The slow loop. Runs every SLOW_LOOP_INTERVAL_MS (~4s) AND can be poked on
 * events. It does NOT call the LLM directly — Hermes owns the model. It runs
 * cheap trigger predicates and, when something fires, surfaces compact state
 * to Hermes via the NudgeSink.
 */
export class SlowLoop {
  private timer: ReturnType<typeof setInterval> | null = null;
  private prev: GameState | null = null;
  private readonly vibe = new VibeCheck();
  private lastNudgeAt = 0;
  /** A goal that just finished, waiting to be surfaced to the brain once. */
  private lastCompleted: BotGoal | null = null;

  constructor(
    private readonly controller: BotController,
    private readonly cfg: Config,
    private readonly sink: NudgeSink,
    private readonly runner: GoalRunner,
    private readonly memory: WorldMemory,
  ) {}

  start(): void {
    this.timer = setInterval(() => this.tick(), this.cfg.tuning.slowLoopIntervalMs);
    log.info(`running every ${this.cfg.tuning.slowLoopIntervalMs}ms`);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Call this on discrete events (chat received) to react faster than the tick. */
  poke(): void {
    this.tick();
  }

  /** The goal runner calls this when a goal finishes — surfaced next tick. */
  notifyGoalComplete(goal: BotGoal): void {
    this.lastCompleted = goal;
  }

  private tick(): void {
    // advance any in-flight goal first, so its state shows in this snapshot
    this.runner.tick();

    const state = this.controller.getState();
    let reason: string | null = null;

    // goal completion takes priority — it's the autonomy loop closing.
    if (this.lastCompleted) {
      const g = this.lastCompleted;
      this.lastCompleted = null;
      reason = `goal "${g.label}" ${g.status}${g.error ? `: ${g.error}` : g.progress ? ` (${g.progress})` : ""}`;
    }
    if (!reason) {
      for (const t of TRIGGERS) {
        reason = t.check(state, this.prev);
        if (reason) break;
      }
    }
    if (!reason) {
      for (const t of MEMORY_TRIGGERS) {
        reason = t.check(state, this.prev, this.memory);
        if (reason) break;
      }
    }
    if (!reason && this.vibe.due()) reason = "vibe check: comment on surroundings if interesting";

    this.prev = state;
    if (!reason) return;

    // Global rate limit so we never spam the brain/the player.
    if (Date.now() - this.lastNudgeAt < 2500) return;
    this.lastNudgeAt = Date.now();

    void this.sink.nudge(reason, state);
  }
}
