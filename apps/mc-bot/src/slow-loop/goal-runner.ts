import type { BotControl, BotGoal, BotIntent, GoalStatus } from "@itto/shared";
import { logger } from "../util/logger.js";

const log = logger("goal");

/** How many skill rounds a verified goal may burn before it admits defeat. */
const MAX_ROUNDS = 6;
/** How long the player gets to pick dropped items up before we call it done anyway. */
const PICKUP_WAIT_MS = 30_000;

function countIn(inventory: Array<{ name: string; count: number }>, item: string): number {
  return inventory.filter((i) => i.name === item).reduce((n, i) => n + i.count, 0);
}

/** Which existing skill is the right tool for gathering this item. */
function gatherSkillFor(item: string): { name: string; args?: Record<string, unknown> } | null {
  if (/(_log|_wood|_stem|_hyphae)$/.test(item)) return { name: "chop_tree" };
  if (/_ore$/.test(item)) return { name: "mine_vein", args: { ore: item } };
  if (item.startsWith("raw_")) return { name: "mine_vein", args: { ore: item.slice(4) + "_ore" } };
  if (["diamond", "emerald", "lapis_lazuli", "redstone", "coal", "quartz"].includes(item)) {
    return { name: "mine_vein", args: { ore: item + "_ore" } };
  }
  return null;
}

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
    if (goal.status !== "active") return;
    const state = this.deps.control.getState();

    // Verified goals fall through even while a step is running, so they can
    // notice "the count is already reached" mid-round. One-shot skills don't
    // need that, and re-entering them would double-run the skill.
    if (this.inflight && goal.intent.kind !== "collect" && goal.intent.kind !== "deliver") return;

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

      // ── Verified goals ────────────────────────────────────────────────
      // These do NOT finish when a skill returns. They finish when the
      // OUTCOME is true, checked against live state every tick. That is the
      // difference between "I swung the axe" and "you have 32 logs".

      case "collect": {
        const { item, count } = goal.intent;
        const have = countIn(state.inventory, item);

        if (have >= count) {
          goal.progress = `${have}/${count} ${item}`;
          this.finish(goal, "done");
          break;
        }

        // A gather round is already running — let it finish, don't stack them.
        if (this.inflight) break;

        const rounds = goal.rounds ?? 0;
        if (rounds >= MAX_ROUNDS) {
          goal.progress = `只弄到 ${have}/${count} ${item}`;
          this.finish(goal, "failed", `弄不到更多了：${have}/${count} ${item}`);
          break;
        }

        const tool = gatherSkillFor(item);
        if (!tool) {
          this.finish(goal, "failed", `不知道用什么办法弄到 ${item}（试试 fetch_item 或者换个目标）`);
          break;
        }

        goal.rounds = rounds + 1;
        goal.progress = `${have}/${count} ${item}（第 ${goal.rounds} 轮）`;
        this.inflight = true;
        this.deps.suspendFollow();
        void this.deps
          .runSkill(tool.name, tool.args)
          .then((res) => {
            goal.progress = `${countIn(this.deps.control.getState().inventory, item)}/${count} ${item} — ${res}`;
          })
          .catch((e) => {
            goal.error = (e as Error).message;
          })
          .finally(() => {
            // NOT finished: the next tick re-counts the inventory and decides.
            this.inflight = false;
          });
        break;
      }

      case "deliver": {
        const { items } = goal.intent;

        if (!goal.droppedAt) {
          const missing = items.filter((it) => countIn(state.inventory, it.name) < it.count);
          if (missing.length > 0) {
            this.finish(
              goal,
              "failed",
              `背包里不够：${missing.map((m) => m.name + "×" + m.count).join("、")}（先 collect 或者去箱子里取）`,
            );
            break;
          }

          if (this.inflight) break;
          this.inflight = true;
          this.deps.suspendFollow();
          void (async () => {
            const player = this.deps.control.getState().player?.pos;
            if (player) await this.deps.control.moveTo(player, { range: 2 });
            for (const it of items) await this.deps.control.dropItem(it.name, it.count);
            goal.droppedAt = Date.now();
            goal.progress = "丢在你脚边了，等你捡";
          })()
            .catch((e) => this.finish(goal, "failed", (e as Error).message))
            .finally(() => {
              this.inflight = false;
            });
          break;
        }

        // Verification: the dropped item entities are gone -> he picked them up.
        const leftovers = this.deps.control.findEntities(["item"], 6).length;
        const waited = Date.now() - goal.droppedAt;
        if (leftovers === 0) {
          goal.progress = "他收下了";
          this.finish(goal, "done");
        } else if (waited > PICKUP_WAIT_MS) {
          goal.progress = "东西丢在他脚边了（还没见他捡）";
          this.finish(goal, "done");
        }
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
    // Anything with real work behind it gets reported back to the brain —
    // including "the task you gave me is finished, give me the next one".
    const trivial =
      goal.intent.kind === "say" || goal.intent.kind === "follow" || goal.intent.kind === "stop";
    if (!trivial) {
      this.deps.onComplete(goal);
    }
    if (this.current?.id === goal.id) this.current = null;
  }
}
