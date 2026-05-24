# Skill: fetch_item

**Tool:** `run_skill` with `name: "fetch_item"`, `args: { name, count? }`. As a goal: `set_goal { intent: { kind: "skill", name: "fetch_item", args: { name: "iron_ingot", count: 5 } }, label: "grab iron" }`.

## When to use
- The player asks you to bring them something that's stored in a chest ("grab me some iron", "bring cobble").

## How
- Looks up which chest holds the item in world memory, walks there, withdraws up to `count` (default 1), re-indexes the chest, and brings it back to the player.
- **Prerequisite:** itto has to KNOW where the item is. Index chests first with the `index_chest` tool (point it at a chest's coords). If nothing's indexed, fetch_item will tell you it doesn't know where the item is.

## Don't
- Don't promise to fetch something from an un-indexed chest. Index first, or go look (`find_blocks any_chest` → `index_chest`).
