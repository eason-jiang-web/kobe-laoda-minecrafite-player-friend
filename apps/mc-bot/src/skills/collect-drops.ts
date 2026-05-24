import type { Skill } from "./types.js";
import { runWithTask } from "./types.js";

/**
 * collect_drops() — walk to and pick up nearby dropped item entities. Handy
 * after a fight or a mining run when loot is scattered on the ground.
 */
export const collectDrops: Skill = {
  name: "collect_drops",
  description: "Walk around and pick up nearby dropped items.",
  async run(ctx, args) {
    const radius = typeof args?.radius === "number" ? args.radius : 12;
    return runWithTask(ctx, async () => {
      const n = await ctx.control.collectNearbyDrops({ radius });
      return n > 0 ? `picked up ${n} dropped items` : "nothing on the ground nearby";
    });
  },
};
