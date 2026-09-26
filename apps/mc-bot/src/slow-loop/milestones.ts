/**
 * Inventory milestones — "tell me when we've got 128 logs".
 *
 * The slow loop already reacts to events (a creeper showed up, a tool is about
 * to break). This is the other half of being a good duo partner: noticing
 * progress. Rules come from MC_REPORT_ITEMS ("any_log:128,rare:10"), fire once
 * when the count crosses the threshold, and re-arm if the items go away (so
 * stashing a haul in a chest and hoarding again reports again).
 */
import type { GameState } from "@itto/shared";

export interface MilestoneRule {
  /** Token from config, e.g. "any_log" or "diamond". */
  key: string;
  /** What the report calls it. */
  label: string;
  threshold: number;
  match(name: string): boolean;
}

/** The genuinely valuable stuff — what "稀有矿物" means in practice. */
const RARE = new Set([
  "diamond",
  "emerald",
  "ancient_debris",
  "netherite_scrap",
  "lapis_lazuli",
  "amethyst_shard",
  "quartz",
  "echo_shard",
  "gold_ingot",
  "raw_gold",
]);

/**
 * Group aliases. `any_log` / `any_ore` intentionally mirror the block aliases
 * in bot/controller.ts so the same words work for "go find it" and "you have
 * enough of it".
 */
const GROUPS: Record<string, { label: string; match: (name: string) => boolean }> = {
  any_log: { label: "木头", match: (n) => /(_log|_wood|_stem|_hyphae)$/.test(n) },
  any_ore: {
    label: "矿石",
    match: (n) => n.endsWith("_ore") || n.startsWith("raw_") || n === "ancient_debris",
  },
  rare: { label: "稀有矿物", match: (n) => RARE.has(n) },
};

/** Parse "any_log:128, diamond:10" into rules. Bad tokens are ignored, not fatal. */
export function parseMilestones(spec: string): MilestoneRule[] {
  const rules: MilestoneRule[] = [];
  for (const token of spec.split(",")) {
    const [rawKey, rawThreshold] = token.split(":");
    const key = (rawKey ?? "").trim().toLowerCase();
    const threshold = Number((rawThreshold ?? "").trim());
    if (key.length === 0 || !Number.isFinite(threshold) || threshold <= 0) continue;

    const group = GROUPS[key];
    rules.push({
      key,
      label: group?.label ?? key,
      threshold,
      match: group?.match ?? ((n: string) => n === key),
    });
  }
  return rules;
}

export class MilestoneTracker {
  /** Rules already reported for the current hoard. */
  private readonly fired = new Set<string>();

  constructor(private readonly rules: MilestoneRule[]) {}

  /** A report line the first time a threshold is crossed, otherwise null. */
  check(state: GameState): string | null {
    for (const rule of this.rules) {
      const matched = state.inventory.filter((i) => rule.match(i.name));
      const total = matched.reduce((sum, i) => sum + i.count, 0);

      if (total < rule.threshold) {
        // Spent, crafted or stashed: arm it again for next time.
        this.fired.delete(rule.key);
        continue;
      }
      if (this.fired.has(rule.key)) continue;

      this.fired.add(rule.key);
      const breakdown = matched
        .slice()
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)
        .map((i) => i.name + "×" + i.count)
        .join("、");
      return (
        "库存里程碑：" + rule.label + " 已经攒到 " + total + " 个（阈值 " + rule.threshold +
        "；" + breakdown + "）—— 跟他说一声"
      );
    }
    return null;
  }
}
