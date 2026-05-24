import type { Bot } from "mineflayer";
import { goals } from "mineflayer-pathfinder";
import { Vec3 } from "vec3";
import type { FollowState } from "@itto/shared";
import type { Config } from "../config.js";

/**
 * Follow-behavior state machine. Implements the spec in CONTEXT.md:
 *
 *   IDLE   dist <= 5      → stay, look at player, small idle movement
 *   DRIFT  dist > 5       → chill pathfind to target range
 *   CATCHUP dist > 10     → sprint pathfind to target range
 *   TASK   (set by skills) → bot is busy; follow yields
 *
 * Rules baked in:
 *  - Hysteresis: target `range` blocks, don't recompute the goal until we
 *    drift past `range + 1` — kills the jitter of constant re-pathing.
 *  - Predictive: path to player_pos + velocity * 0.5, not the stale position.
 *  - Teleport fallback for >30 blocks is handled in BotController.moveTo.
 */
export class FollowController {
  private state: FollowState = "IDLE";
  private lastGoalPos: Vec3 | null = null;
  /** When true (set by the skill executor), the SM stands down. */
  private suspended = false;

  constructor(
    private bot: Bot,
    private readonly cfg: Config,
  ) {}

  /** Re-point at a fresh connection after a reconnect. */
  rebind(bot: Bot): void {
    this.bot = bot;
    this.lastGoalPos = null;
    this.state = "IDLE";
    this.suspended = false;
  }

  getState(): FollowState {
    return this.suspended ? "TASK" : this.state;
  }

  suspend(): void {
    this.suspended = true;
    this.bot.pathfinder.stop();
  }
  resume(): void {
    this.suspended = false;
    this.lastGoalPos = null;
  }

  /** Called every fast-loop tick. Cheap; only re-paths when needed. */
  tick(): void {
    if (this.suspended) return;

    const player = this.bot.players[this.cfg.mc.ownerUsername]?.entity;
    if (!player) {
      this.state = "IDLE";
      return;
    }

    const me = this.bot.entity.position;
    const dist = me.distanceTo(player.position);
    const range = this.cfg.tuning.followTargetRange; // desired standoff (~3)
    const stopDist = range + 1; // stop closing in around here, so we settle ~3-4 away
    const tooClose = 2; // any closer and we're in his face / blocking his view

    // In his face — back off to ~range so we're not blocking his vision.
    if (dist < tooClose) {
      this.state = "IDLE";
      const away = me.minus(player.position);
      const dir = away.norm() > 0.01 ? away.normalize() : new Vec3(1, 0, 0);
      const spot = player.position.plus(dir.scaled(range));
      this.bot.pathfinder.setGoal(new goals.GoalNear(spot.x, spot.y, spot.z, 1), false);
      this.lastGoalPos = null;
      return;
    }

    // Comfortable distance — STOP pathing (this is the bug fix: previously the
    // dynamic goal kept running and glued us onto him) and just be present.
    if (dist <= stopDist) {
      this.state = "IDLE";
      if (this.lastGoalPos) {
        this.bot.pathfinder.setGoal(null);
        this.lastGoalPos = null;
      }
      this.bot.lookAt(player.position.offset(0, 1.6, 0), false);
      return;
    }

    // Too far — catch up to ~range blocks away.
    this.state = dist > 10 ? "CATCHUP" : "DRIFT";

    // Predictive target: where the player is heading.
    const predicted = player.position.plus((player.velocity as Vec3).scaled(0.5));

    // Hysteresis: only recompute the goal if we've drifted past range+1
    // from the last goal we set.
    if (this.lastGoalPos && this.lastGoalPos.distanceTo(predicted) < range + 1) return;
    this.lastGoalPos = predicted;

    this.bot.pathfinder.setGoal(
      new goals.GoalNear(predicted.x, predicted.y, predicted.z, range),
      true, // dynamic: keep updating as we go
    );
  }
}
