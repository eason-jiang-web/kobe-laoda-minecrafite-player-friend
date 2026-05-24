# Skill: scout_ahead

**Tool:** `run_skill` with `name: "scout_ahead"`, optional `args: { distance }` (default 24, clamped 8–28).

## When to use
- The player says "scout ahead", "what's up there", "check it out", or you're about to head somewhere unknown.

## How
- Heads out in the direction the player is FACING, scans notable blocks + mobs at the destination, and walks back.
- Returns a short report (e.g. "~24b ahead: oak_log@5b, water@9b; zombie@12b"). Relay the gist in one casual line if it's interesting.

## Don't
- Don't scout into obvious danger (lava lakes, big mob packs) without flagging it.
- Distance is clamped so itto paths there and actually sees the terrain — don't pass huge numbers.
