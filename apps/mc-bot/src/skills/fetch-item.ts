import type { Skill } from "./types.js";
import { runWithTask } from "./types.js";

/**
 * fetch_item(name, count?) — look up which chest holds the item (from world
 * memory), go withdraw it, re-index that chest, and bring it back to the
 * player. Index chests first with the `index_chest` tool so itto knows where
 * things are.
 */
export const fetchItem: Skill = {
  name: "fetch_item",
  description: "Go to a remembered chest, grab an item, and bring it back to the player. Index chests first.",
  async run(ctx, args) {
    const name = String(args?.name ?? "");
    if (!name) return "fetch_item needs an item name";
    const count = typeof args?.count === "number" ? args.count : 1;

    const hits = ctx.memory.findChestsWithItem(name, ctx.control.dimension());
    if (hits.length === 0) return `dunno where any ${name} is — index a chest with it first`;

    return runWithTask(ctx, async () => {
      for (const { chest } of hits.slice(0, 3)) {
        try {
          const took = await ctx.control.withdrawFromContainer(chest.pos, name, count);
          if (took > 0) {
            // keep the chest's remembered contents fresh after taking from it
            try {
              const contents = await ctx.control.readContainer(chest.pos);
              ctx.memory.indexChest({ pos: chest.pos, dimension: ctx.control.dimension(), contents });
            } catch {
              /* re-index is best-effort */
            }
            const player = ctx.control.getState().player?.pos;
            if (player) await ctx.control.moveTo(player, { range: 2 });
            return `grabbed ${took} ${name} and brought it back`;
          }
        } catch {
          /* try the next chest */
        }
      }
      return `couldn't find ${name} in the chests i know about`;
    });
  },
};
