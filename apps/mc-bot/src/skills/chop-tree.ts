import type { Skill } from "./types.js";
import { runWithTask } from "./types.js";
import { connectedComponent } from "./_geometry.js";

/**
 * chop_tree() — find the nearest tree, mine its whole connected trunk (incl.
 * branches), and pick up the logs. The headline "do a real thing" skill.
 */
export const chopTree: Skill = {
  name: "chop_tree",
  description: "Find the nearest tree, chop the whole trunk, and collect the logs.",
  async run(ctx) {
    return runWithTask(ctx, async () => {
      const logs = await ctx.control.findBlocks({ name: "any_log", maxDistance: 32, count: 24 });
      if (logs.length === 0) return "no trees nearby";
      const trunk = connectedComponent(logs, logs[0]!, 32);
      // bottom-up so we don't leave floating logs out of reach
      trunk.sort((a, b) => a.y - b.y);
      const mined = await ctx.control.mineMany(trunk);
      // sweep the columns to vanilla-collect the logs, plus a best-effort entity grab
      await ctx.control.sweepColumns(trunk);
      await ctx.control.collectNearbyDrops({ radius: 6 });
      return mined > 0 ? `chopped ${mined} logs` : "couldn't reach that tree";
    });
  },
};
