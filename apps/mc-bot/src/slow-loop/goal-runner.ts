import type { BotControl, BotGoal, BotIntent, GoalStatus } from "@itto/shared";
import { logger } from "../util/logger.js";

const log = logger("goal");

export interface GoalRunnerDeps {
  control: BotControl;
  /** Run a skill by name (wired to skills/index.ts runSkillByName). */
  runSkill(name: string, args?: Record<string, unknown>): Promise<string>;
  suspendFollow(): void;
  resumeFollow(): void;
  /** Fired when a goal finishes (done/failed) so the slow loop can nudge the brain. */
  onComplete(goal: BotGoal): void;
}

/**
 * Turns the brain's `BotIntent` into a real, multi-tick pursuit. The brain sets
 * a goal (via set_goal), the runner advances it ONE non-blocking step per slow-
 * loop tick, and reports completion back so the brain can react. This is what
 * lets one nudge kick off "go chop a tree" and hear "done" when it finishes.
 *
 * Reflexes stay in the fast loop; long thinking stays in the brain. This is the
 * thin executor in between.
 */
export class GoalRunner {
  private current: BotGoal | null = null;
  private queue: BotGoal[] = [];
  /** Most recently finished goal — for pollers (voice bridge) to read. */
  private lastFinished: BotGoal | null = null;
  /** True while a skill/say is awaiting — stops us re-launching it every tick. */
  private inflight = false;

  constructor(private readonly deps: GoalRunnerDeps) {}

  setGoal(intent: BotIntent, label: string): BotGoal {
    this.cancel();
    this.current = this.make(intent, label);
    return this.current;
  }

  enqueue(intent: BotIntent, label: string): BotGoal {
    const goal = this.make(intent, label);
    if (!this.current) this.current = goal;
    else this.queue.push(goal);
    return goal;
  }

  cancel(): void {
    if (this.current?.status === "active") {
      this.current.status = "cancelled";
      this.current.updatedAt = Date.now();
      this.deps.control.stop();
      this.deps.resumeFollow();
    }
    this.current = null;
    this.queue = [];
    this.inflight = false;
  }

  currentGoal(): BotGoal | null {
    return this.current;
  }

  /** The last goal that finished (done/failed). Lingers for state pollers. */
  lastGoalFinished(): BotGoal | null {
    return this.lastFinished;
  }

  /** Advance the current goal one step. Called every slow-loop tick. */
  tick(): void {
    if (!this.current) {
      const next = this.queue.shift();
      if (!next) return;
      this.current = next;
    }
    const goal = this.current;
    if (goal.status !== "active" || this.inflight) return;

    switch (goal.intent.kind) {
      case "say": {
        this.inflight = true;
        const { text } = goal.intent;
        void this.deps.control
          .chat(text)
          .then(() => this.finish(goal, "done"))
          .catch((e) => this.finish(goal, "failed", (e as Error).message));
        break;
      }
      case "skill": {
        this.inflight = true;
        this.deps.suspendFollow();
        const { name, args } = goal.intent;
        void this.deps
          .runSkill(name, args)
          .then((res) => {
            goal.progress = res;
            this.finish(goal, "done");
          })
          .catch((e) => this.finish(goal, "failed", (e as Error).message))
          .finally(() => this.deps.resumeFollow());
        break;
      }
      case "follow": {
        this.deps.resumeFollow();
        goal.progress = "following";
        this.finish(goal, "done");
        break;
      }
      case "stop": {
        this.deps.control.stop();
        this.deps.resumeFollow();
        this.finish(goal, "done");
        break;
      }
    }
  }

  private make(intent: BotIntent, label: string): BotGoal {
    const now = Date.now();
    return { id: crypto.randomUUID(), intent, label, status: "active", createdAt: now, updatedAt: now };
  }

  private finish(goal: BotGoal, status: GoalStatus, error?: string): void {
    goal.status = status;
    goal.updatedAt = Date.now();
    if (error) goal.error = error;
    this.lastFinished = goal;
    this.inflight = false;
    log.debug(`goal "${goal.label}" → ${status}${error ? ": " + error : ""}`);

    // Only nudge the brain for the things worth reacting to: a skill that
    // finished/failed (the autonomy loop), or any failure. Trivial say/follow/
    // stop successes don't re-poke the brain (avoids feedback loops).
    if (goal.intent.kind === "skill" || status === "failed") {
      this.deps.onComplete(goal);
    }
    if (this.current?.id === goal.id) this.current = null;
  }
}
