import type { Skill } from "./types.js";
import { runWithTask } from "./types.js";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * What "found it" means for each thing you can be sent to look for. Blocks and
 * entities are both signals — a village is mostly villagers (entities) plus a
 * bell / composter / lectern (blocks).
 */
const SCAN: Record<string, { label: string; entities?: string[]; blocks?: string[] }> = {
  village: { label: "村庄", entities: ["villager", "iron_golem"], blocks: ["bell", "composter", "lectern"] },
  water: { label: "水源", blocks: ["water"] },
  lava: { label: "岩浆", blocks: ["lava"] },
  animal: { label: "动物", entities: ["cow", "pig", "sheep", "chicken"] },
  chest: { label: "箱子", blocks: ["chest", "barrel"] },
};

/**
 * explore_for(target) — actually go LOOK for something instead of trailing the
 * player. Walks a growing square spiral (legs kept under the 30-block teleport
 * fallback, so it really walks and really sees terrain), scanning at every stop.
 *
 * Returns a sentence with coordinates when found, or how much ground it covered
 * when it gives up — either way the brain can tell the player something true.
 */
export const exploreFor: Skill = {
  name: "explore_for",
  description:
    "Go search the world for something (village, water, lava, animal, chest) by walking a spiral and scanning, then report where it is.",
  async run(ctx, args) {
    const raw = String(args?.target ?? "village").toLowerCase();
    const spec = SCAN[raw] ?? SCAN.village!;
    const maxLegs = clamp(Number(args?.legs ?? 8), 2, 16);

    return runWithTask(ctx, async () => {
      const start = ctx.control.getState().self.pos;

      const scan = async (): Promise<string | null> => {
        if (spec.entities) {
          const hit = ctx.control.findEntities(spec.entities, 72)[0];
          if (hit) {
            return `找到了 ${spec.label}：${hit.name} 在 (${Math.round(hit.pos.x)}, ${Math.round(hit.pos.y)}, ${Math.round(hit.pos.z)})，离我 ${hit.distance} 格`;
          }
        }
        if (spec.blocks) {
          for (const b of spec.blocks) {
            const found = await ctx.control.findBlocks({ name: b, maxDistance: 64, count: 1 });
            const at = found[0];
            if (at) {
              return `找到了 ${spec.label}：${b} 在 (${Math.round(at.x)}, ${Math.round(at.y)}, ${Math.round(at.z)})`;
            }
          }
        }
        return null;
      };

      const immediate = await scan();
      if (immediate) return immediate;

      let bearing = Math.random() * Math.PI * 2;
      let legLength = 18;
      let travelled = 0;

      for (let leg = 0; leg < maxLegs; leg++) {
        const from = ctx.control.getState().self.pos;
        const dest = {
          x: Math.round(from.x + Math.cos(bearing) * legLength),
          y: from.y,
          z: Math.round(from.z + Math.sin(bearing) * legLength),
        };
        try {
          await ctx.control.moveTo(dest, { range: 2, sprint: true });
          travelled += legLength;
        } catch {
          // blocked terrain / interrupted: just turn and try another direction
        }

        const hit = await scan();
        if (hit) {
          // Walk the player over to it so the payoff is real, not just a coords line.
          try {
            await ctx.control.moveTo(dest, { range: 3 });
          } catch {
            /* best effort */
          }
          return `${hit}（我走过去那边了，坐标记一下）`;
        }

        bearing += Math.PI / 2 + (Math.random() * 0.5 - 0.25); // mostly turn 90°
        legLength = Math.min(28, Math.round(legLength * 1.2)); // spiral out, never >30 (no teleport)
      }

      return `绕着 (${Math.round(start.x)}, ${Math.round(start.z)}) 走了 ${maxLegs} 段、约 ${travelled} 格，没找到${spec.label}`;
    });
  },
};
