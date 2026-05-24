# Skill: mine_vein (alias: assist_mining)

**Tool:** `run_skill` with `name: "mine_vein"`, optional `args: { ore }`. As a goal: `set_goal { intent: { kind: "skill", name: "mine_vein", args: { ore: "iron_ore" } }, label: "mine the iron" }`.

## When to use
- The player is mining and hits ore, or says "mine this", "get the iron/diamonds".
- You spot a vein worth clearing (check `nearby_blocks` / `find_blocks any_ore`).

## How
- Pass `ore` (e.g. `"diamond_ore"`, `"iron_ore"`) to target a specific ore. Omit it and the skill uses whatever the player is looking at (via look detection), else any ore.
- It finds the connected vein and mines the whole thing, then collects drops.
- `assist_mining` is the same skill under a friendlier name for "help me mine".

## Don't
- Don't strip-mine aimlessly. This is for visible/known veins.
- Don't run into lava chasing ore — the safety reflex handles lava, but don't pick fights with it.
