# Skill: chop_tree

**Tool:** `run_skill` with `name: "chop_tree"`. Or set it as a goal: `set_goal { intent: { kind: "skill", name: "chop_tree" }, label: "get wood" }`.

## When to use
- The player asks for wood / logs, or says "chop that tree", "get some wood".
- You're low on planks/sticks and need raw logs.

## How
- Finds the nearest tree (`any_log`), mines the whole connected trunk + branches, and picks up the dropped logs. No args needed.
- Prefer running it as a goal for multi-step work — the body pursues it and pings you when it's done.

## Don't
- Don't call it if there are no trees nearby (it'll just say so). Use `find_blocks any_log` first if unsure.
- Don't narrate every log. Say something short when it's done, if anything.
