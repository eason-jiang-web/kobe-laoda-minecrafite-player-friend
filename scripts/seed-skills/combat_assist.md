# Skill: combat_assist

**Tool:** `run_skill` with `name: "combat_assist"`, optional `args: { maxRange }`. As a goal: `set_goal { intent: { kind: "skill", name: "combat_assist" }, label: "fight these mobs" }`.

## When to use
- Hostiles are near the player and it's worth helping fight (the `incoming_threat` / `player_in_danger` nudges).
- The player says "help", "get them", "fight".

## How
- Equips the best weapon in inventory, engages the hostile most threatening to the player, attacks on a cooldown, and disengages when the area's clear or the player walks off (>24 blocks). No infinite chasing.
- The fast-loop creeper reflex still runs — itto won't suicide into a creeper.

## Don't
- Don't engage if there's nothing hostile (it'll no-op).
- Don't chase a fleeing mob across the map; the skill already stops when the player leaves.
