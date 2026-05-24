import type { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { logger } from "../util/logger.js";

const log = logger("safety");

/**
 * Reactive safety reflexes. Pure code, no LLM — this is what keeps the bot
 * from standing in lava while Claude is "thinking". Runs every fast-loop tick.
 *
 * Returns true if it took an overriding action this tick (so the follow SM
 * can yield). Order matters: most lethal first.
 */
export class SafetyReflexes {
  private lastEatAt = 0;

  constructor(private bot: Bot) {}

  /** Re-point at a fresh connection after a reconnect. */
  rebind(bot: Bot): void {
    this.bot = bot;
  }

  tick(): boolean {
    if (this.avoidLava()) return true;
    if (this.fleeOrFaceThreat()) return true;
    if (this.eatIfHungry()) return false; // eating doesn't block following
    return false;
  }

  /** If a dangerous block is under/at the bot, step off it. */
  private avoidLava(): boolean {
    const feet = this.bot.blockAt(this.bot.entity.position);
    const below = this.bot.blockAt(this.bot.entity.position.offset(0, -1, 0));
    const danger = (b: ReturnType<Bot["blockAt"]>) =>
      b && (b.name === "lava" || b.name === "fire" || b.name === "magma_block");

    if (danger(feet) || danger(below)) {
      log.warn("danger underfoot — bailing");
      // crude: jump + sprint backward. A real impl picks a safe neighbor block.
      this.bot.setControlState("jump", true);
      this.bot.setControlState("back", true);
      setTimeout(() => {
        this.bot.setControlState("jump", false);
        this.bot.setControlState("back", false);
      }, 400);
      return true;
    }
    return false;
  }

  /** Very close hostile → back off / face it so combat_assist can take over. */
  private fleeOrFaceThreat(): boolean {
    const mob = this.bot.nearestEntity(
      (e) => !!e.name && ["creeper", "warden"].includes(e.name),
    );
    if (!mob) return false;
    const dist = this.bot.entity.position.distanceTo(mob.position);
    if (mob.name === "creeper" && dist < 4) {
      // creeper too close — retreat, do NOT let the LLM dawdle on this
      const away = this.bot.entity.position
        .minus(mob.position)
        .normalize()
        .scaled(6)
        .plus(this.bot.entity.position);
      this.bot.lookAt(new Vec3(away.x, away.y, away.z));
      this.bot.setControlState("sprint", true);
      this.bot.setControlState("forward", true);
      setTimeout(() => {
        this.bot.setControlState("sprint", false);
        this.bot.setControlState("forward", false);
      }, 600);
      return true;
    }
    return false;
  }

  /** Auto-eat when food is low and we have something edible. */
  private eatIfHungry(): boolean {
    if (this.bot.food > 6) return false;
    if (Date.now() - this.lastEatAt < 4000) return false;
    const food = this.bot.inventory.items().find((i) => /apple|bread|cooked|carrot|potato|steak|porkchop|mutton|stew/.test(i.name));
    if (!food) return false;
    this.lastEatAt = Date.now();
    void this.bot.equip(food, "hand").then(() => this.bot.consume().catch(() => {}));
    return true;
  }
}
