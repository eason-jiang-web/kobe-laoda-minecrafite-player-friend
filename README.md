# itto

> an ai buddy that joins your minecraft world, follows you around, helps out, and hangs in your discord call. :3

You log in, itto spawns next to you, joins your voice call, and you just play
together. It talks, it helps, it learns your playstyle over sessions. Not a
coach. Not a tutorial bot. A duo partner.

Full project spec: **[docs/CONTEXT.md](./docs/CONTEXT.md)**. Build order and
where to start: **[docs/ROADMAP.md](./docs/ROADMAP.md)**. Who runs what:
**[docs/RUNBOOK.md](./docs/RUNBOOK.md)**. Architecture map:
**[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**.

## How it's built

itto is split into a body that lives in the game and a brain that thinks about
it from outside, connected over the [Model Context Protocol](https://modelcontextprotocol.io).

| Piece | What it is |
|---|---|
| **Hermes** (Nous Research) | The brain. Runs Claude plus Discord voice. Lives **outside this repo** and connects over MCP. It owns the model; the bot never calls Claude directly. |
| **`apps/mc-bot`** | The body. A [Mineflayer](https://github.com/PrismarineJS/mineflayer) bot with a 15Hz fast loop (follow and safety) and a roughly 4 second slow loop (decide when to react). |
| **`packages/mcp-server`** | The nervous system. Exposes the bot's actions as MCP tools and its world state as MCP resources, so the external brain can perceive and act. |
| **`packages/shared`** | Types, zod schemas, the `BotControl` interface, and the system prompt that gives itto its personality. |
| **`apps/web`** | Landing page. |

## The two loops

The core design idea is that reflexes and reasoning run on different clocks.

**Fast loop, 15Hz, no LLM.** Pure code. Every tick it runs safety reflexes
(get out of lava, eat when food is low, flee a creeper) and advances a follow
state machine, then pushes movement to Mineflayer. This is what keeps itto
alive and next to you, and it never waits on a network call. The LLM is never
in the hot path of "am I standing in lava."

**Slow loop, roughly every 4 seconds or on an event.** It snapshots the game
into a compact `GameState` (position, inventory, nearby mobs, your location,
chat, health, time of day, about 1 to 2 KB of structured json, no screenshots),
runs cheap trigger predicates, and if something notable fired (you said
"itto", a hostile appeared, health dropped, inventory filled) it nudges the
brain with the reason and the state. Meanwhile a goal runner ticks through any
multi-step skill the brain has queued.

Because state comes straight from Mineflayer's in-memory model, perception is
basically free and token-cheap. Vision (occasional vibe-check screenshots) is
designed for but not yet wired in, on purpose: structured state is enough 95%
of the time.

## What itto can do

The brain drives the bot through MCP tools registered in
`packages/mcp-server/src/tools/`. Every tool returns an `{ ok, message }`
envelope.

| Tool | What it does |
|---|---|
| `move_to`, `look_at`, `stop` | pathfind to a coordinate, aim, cancel movement |
| `mine_block`, `place_block`, `dig_at`, `mine_many` | break and place blocks |
| `equip`, `drop_item`, `craft_item` | inventory and crafting (finds a nearby table when needed) |
| `find_blocks`, `nearby_notable`, `look_for_player` | perception queries (supports aliases like `any_ore`, `any_log`) |
| `chat` | send in-game text (voice goes through Hermes and Discord) |
| `set_goal`, `cancel_goal` | queue or stop a multi-step goal |
| `run_skill` | run a named skill |

Skills are the higher-level behaviors, all dispatched through a single
`runSkillByName()` path in `apps/mc-bot/src/skills/`:

| Skill | Behavior |
|---|---|
| `follow_player` | resume following at a target range (default 3 blocks) |
| `assist_mining` / `mine_vein` | find an ore vein via connected-component detection, clear it, sweep up drops |
| `combat_assist` | equip the best weapon, engage the nearest threat to you, disengage when it's clear |
| `scout_ahead` | path out in your heading, scan for notable blocks and mobs, come back |
| `build_helper` | place blocks from a `{ placements: [{pos, item}] }` spec, report any shortfall |
| `chop_tree` | harvest logs |
| `fetch_item` | retrieve a known item from a known chest (memory-backed) |
| `collect_drops`, `inventory_report` | pick up nearby drops, summarize what's carried |

The follow behavior is a state machine (IDLE, DRIFT, CATCHUP, TASK) with
hysteresis so it doesn't jitter, predictive pathing to where you're heading
rather than where you were, personal-space backoff, and a teleport fallback for
gaps bigger than 30 blocks. World memory (waypoints, a chest index, notes)
persists in SQLite via `bun:sqlite` and survives restarts and reconnects.

## Layout

```
itto/
├── apps/
│   ├── mc-bot/        # Mineflayer bot: fast-loop, slow-loop, skills, state, bot/
│   └── web/           # landing page (owned separately, not part of the bot build)
├── packages/
│   ├── mcp-server/    # MCP server (tools + resources the external brain drives)
│   ├── shared/        # types, zod schemas, prompts, the BotControl interface
│   └── discord-bridge/# optional DIY voice, for later
├── infra/             # docker-compose (local MC server), deploy/
├── docs/              # CONTEXT.md (spec), ROADMAP.md, ARCHITECTURE.md, HERMES_SETUP.md
└── scripts/           # dev.sh, seed-skills/ (Hermes markdown templates)
```

## Quick start

Runs on [Bun](https://bun.sh). Bun executes the TypeScript directly, no Node or
tsx in the loop.

```bash
# 0. tooling
curl -fsSL https://bun.sh/install | bash   # if you don't have bun

# 1. install
bun install

# 2. config
cp .env.example .env
#   fill in at least MC_OWNER_USERNAME (your MC username, the player itto follows)

# 3. local minecraft + the bot (one command)
./scripts/dev.sh
#   or manually:
#   bun run mc:up     # docker paper server on :25565
#   bun run bot       # bot + MCP server on :3001

# 4. wire up the brain (separate process, see docs/HERMES_SETUP.md)
hermes mcp add itto http://localhost:3001/mcp
hermes platform discord enable
```

Then hop in the MC world and the Discord call and play.

Key environment variables (full list in `.env.example`): `MC_SERVER_HOST` /
`MC_SERVER_PORT` / `MC_VERSION` (default 1.20.6) for the server, `MC_AUTH`
(`offline` or `microsoft`), `MC_OWNER_USERNAME` (required), and `MCP_PORT`
(default 3001) for the MCP endpoint.

## Deploy the landing page on Vercel

The landing page lives in `apps/web`, so create the Vercel project with:

| Setting | Value |
|---|---|
| **Root Directory** | `apps/web` |
| **Framework Preset** | `Next.js` |
| **Install Command** | `bun install` |
| **Build Command** | `bun run build` |
| **Output Directory** | leave blank, Vercel default |

Set this environment variable in Vercel:

```bash
NEXT_PUBLIC_SITE_URL=https://itto.stephenhung.me
```

That URL is used for canonical metadata, `robots.txt`, `sitemap.xml`, and JSON-LD.
Change it if the production domain is different.

## Status

Early scaffold. The structure, both loops, the control surface, the MCP tools,
and the seed skills are wired and working. Follow, mining, combat, building,
pathfinding, and crafting are implemented; the deeper pieces (full session
memory, vibe-check vision, the Hermes nudge channel) are marked `TODO`. See
`CONTEXT.md` for what's still open.

## Don'ts (from CONTEXT.md)

- Don't put LLM calls in the fast loop.
- Don't use screenshots when Mineflayer's structured state suffices.
- Don't fork Hermes. Depend on it via MCP.
- Don't make the bot proactively chatty. It mostly listens.
- Don't pathfind long routes (over 30 blocks). Teleport instead.
