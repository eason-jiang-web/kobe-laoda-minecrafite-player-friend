import type { Skill, SkillContext } from "./types.js";
import { runWithTask } from "./types.js";
import { connectedComponent } from "./_geometry.js";

/**
 * Shared body for assist_mining / mine_vein. Picks a target ore (explicit arg,
 * else what the player is looking at, else any ore), finds the connected vein,
 * mines it out, and collects the drops.
 */
async function mineVeinBody(ctx: SkillContext, args?: Record<string, unknown>): Promise<string> {
  return runWithTask(ctx, async () => {
    let ore = typeof args?.ore === "string" ? args.ore : null;
    if (!ore) {
      const look = await ctx.control.lookingAt();
      ore = look && look.name.endsWith("_ore") ? look.name : "any_ore";
    }
    const seeds = await ctx.control.findBlocks({ name: ore, maxDistance: 16, count: 32 });
    if (seeds.length === 0) return `no ${ore} to mine nearby`;
    const vein = connectedComponent(seeds, seeds[0]!, 32);
    const mined = await ctx.control.mineMany(vein);
    await ctx.control.sweepColumns(vein);
    await ctx.control.collectNearbyDrops({ radius: 6 });
    return mined > 0 ? `cleared a vein of ${mined} ${ore}` : `couldn't reach the ${ore}`;
  });
}

export const assistMining: Skill = {
  name: "assist_mining",
  description: "Mine alongside the player — find and clear a nearby ore vein (or whatever they're looking at).",
  run: mineVeinBody,
};

export const mineVein: Skill = {
  name: "mine_vein",
  description: "Mine out a connected ore vein. Pass { ore: 'iron_ore' } or it uses what the player is looking at.",
  run: mineVeinBody,
};
