import { PlacementSpecInput } from "@itto/shared";
import type { Skill } from "./types.js";
import { runWithTask } from "./types.js";

/**
 * build_helper(spec) — place blocks per a { placements: [{pos,item}] } spec.
 * Pre-flights materials against inventory, places what it can afford, and
 * reports what it ran short on instead of silently failing.
 */
export const buildHelper: Skill = {
  name: "build_helper",
  description: "Place blocks following a { placements: [{pos,item}] } spec. Places what it can afford and reports shortfalls.",
  async run(ctx, args) {
    const parsed = PlacementSpecInput.safeParse(args);
    if (!parsed.success) {
      return `build_helper needs { placements: [{pos,item}] } — ${parsed.error.issues[0]?.message ?? "invalid spec"}`;
    }
    const { placements } = parsed.data;

    return runWithTask(ctx, async () => {
      const have = new Map<string, number>();
      for (const it of ctx.control.getState().inventory) {
        have.set(it.name, (have.get(it.name) ?? 0) + it.count);
      }

      let done = 0;
      const missing = new Map<string, number>();
      for (const p of placements) {
        const avail = have.get(p.item) ?? 0;
        if (avail <= 0) {
          missing.set(p.item, (missing.get(p.item) ?? 0) + 1);
          continue;
        }
        try {
          await ctx.control.placeBlock(p.pos, p.item);
          done++;
          have.set(p.item, avail - 1);
        } catch {
          missing.set(p.item, (missing.get(p.item) ?? 0) + 1);
        }
      }

      const shortfall = [...missing.entries()].map(([k, v]) => `${k}x${v}`).join(", ");
      return `placed ${done}/${placements.length}${shortfall ? `, short on: ${shortfall}` : ""}`;
    });
  },
};
