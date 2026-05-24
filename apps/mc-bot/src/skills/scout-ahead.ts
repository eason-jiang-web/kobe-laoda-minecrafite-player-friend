import type { Skill } from "./types.js";
import { runWithTask } from "./types.js";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * scout_ahead(distance) — head out in the direction the player is facing, scan
 * what's there (notable blocks + mobs), and walk back. Distance is clamped
 * under the teleport-fallback so itto actually paths and sees the terrain.
 */
export const scoutAhead: Skill = {
  name: "scout_ahead",
  description: "Range ahead in the player's facing direction, scan what's out there, and come back.",
  async run(ctx, args) {
    const distance = clamp(typeof args?.distance === "number" ? args.distance : 24, 8, 28);
    return runWithTask(ctx, async () => {
      const player = ctx.control.getState().player;
      if (!player?.pos) return "no player heading to scout from";
      const dir = ctx.control.playerHeading();
      if (!dir) return "can't read your heading";

      const dest = {
        x: Math.round(player.pos.x + dir.x * distance),
        y: player.pos.y,
        z: Math.round(player.pos.z + dir.z * distance),
      };
      await ctx.control.moveTo(dest, { range: 2, sprint: true });

      const notable = await ctx.control.nearbyNotable(32);
      const after = ctx.control.getState();
      const stuff = notable.length ? notable.map((n) => `${n.name}@${n.distance}b`).join(", ") : "nothing notable";
      const mobs = after.nearbyHostiles.length
        ? after.nearbyHostiles.map((h) => `${h.name}@${h.distance}b`).join(", ")
        : "no mobs";

      // head back toward the player
      const back = ctx.control.getState().player?.pos;
      if (back) await ctx.control.moveTo(back, { range: 3 });

      return `~${distance}b ahead: ${stuff}; ${mobs}`;
    });
  },
};
