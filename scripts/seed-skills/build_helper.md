# Skill: build_helper

**Tool:** `run_skill` with `name: "build_helper"`, `args: { placements: [{ pos: {x,y,z}, item }] }`.

## When to use
- The player wants help placing blocks in a pattern (a wall, floor, pillars, simple structure).

## How
- Pass a `placements` list of `{ pos, item }`. itto pre-checks materials against its inventory, places what it can afford, and reports any shortfalls (e.g. "placed 18/24, short on: oak_planks x6").
- Generate the coords yourself from what the player describes (a 5x1 wall at y=64, etc.).

## Don't
- Don't pass placements for items itto isn't carrying without expecting a shortfall report.
- Keep builds modest per call; chain calls for bigger structures.
