# Skill: collect_drops

**Tool:** `run_skill` with `name: "collect_drops"`, optional `args: { radius }` (default 12).

## When to use
- After a fight or a mining run when loot is scattered on the ground.
- The player says "grab the drops", "pick that up".

## How
- Walks to nearby dropped item entities and picks them up. Returns how many it grabbed.
- chop_tree and mine_vein already collect their own drops — use this for loose loot they didn't get, or mob drops after combat.

## Don't
- Don't run it when nothing's on the ground (it'll just say so).
