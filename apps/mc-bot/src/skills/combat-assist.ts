import type { InventoryItem } from "@itto/shared";
import type { Skill } from "./types.js";
import { runWithTask } from "./types.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Best-to-worst weapon match order. First inventory item that matches wins. */
const WEAPON_PRIORITY = [
  /^netherite_sword$/, /^diamond_sword$/, /^iron_sword$/, /^stone_sword$/,
  /^golden_sword$/, /^wooden_sword$/, /_axe$/,
];

function pickWeapon(inv: InventoryItem[]): string | null {
  for (const rx of WEAPON_PRIORITY) {
    const hit = inv.find((i) => rx.test(i.name));
    if (hit) return hit.name;
  }
  return null;
}

/**
 * combat_assist() — equip the best weapon, engage the hostile most threatening
 * to the player, attack on a cooldown, and disengage when the area's clear or
 * the player wanders off (no infinite chasing). The fast-loop creeper reflex
 * still runs concurrently, so itto won't suicide into a creeper here.
 */
export const combatAssist: Skill = {
  name: "combat_assist",
  description: "Fight nearby hostile mobs threatening the player. Equips a weapon, engages the closest threat, disengages when clear.",
  async run(ctx, args) {
    const maxRange = typeof args?.maxRange === "number" ? args.maxRange : 16;
    return runWithTask(ctx, async () => {
      const weapon = pickWeapon(ctx.control.getState().inventory);
      if (weapon) await ctx.control.equip(weapon);

      let engaged = false;
      for (let i = 0; i < 120; i++) {
        const player = ctx.control.getState().player;
        if (player?.distance != null && player.distance > 24) {
          return engaged ? "fell back to you" : "you walked off, standing down";
        }
        const target = ctx.control.nearestHostile({
          maxDistance: maxRange,
          preferThreatTo: player?.pos ?? undefined,
        });
        if (!target) break;
        engaged = true;
        try {
          await ctx.control.moveTo(target.pos, { range: 2, sprint: true });
          await ctx.control.attack(target.id);
        } catch {
          /* target moved or died mid-swing — re-target next loop */
        }
        await sleep(600);
      }
      return engaged ? "cleared the area" : "nothing to fight";
    });
  },
};
