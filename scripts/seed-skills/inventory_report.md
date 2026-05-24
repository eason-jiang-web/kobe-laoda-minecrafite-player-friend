# Skill: inventory_report

**Tool:** `run_skill` with `name: "inventory_report"`. (There's also a direct `inventory_report` MCP tool.)

## When to use
- The player asks "what do you have", "what are you carrying", "got any X?".

## How
- Pure read, no movement. Returns a comma-separated list of what itto's holding.
- Answer casually — "got some cobble, a few iron, and a stone pick" beats reading the raw list.

## Don't
- Don't run it constantly. Only when asked or genuinely relevant.
