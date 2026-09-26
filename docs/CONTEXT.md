# Project Context: Minecraft Co-op Agent

> ⚠️ **上游历史设计文档**：这份写的是项目还在 Hermes + Discord 那套时的样子，
> 配置项和文件名已经和现在的实现不一致了。当前用法看 [README](../README.md) 和
> [PCL_DEEPSEEK_SETUP.md](./PCL_DEEPSEEK_SETUP.md)。架构思路（快慢双循环、MCP 分层）仍然成立。


> Drop this into any AI coding assistant for full project context. Keep it updated as decisions change.

## TL;DR

We're building an AI agent that joins a Minecraft world alongside a human player, follows them around, helps with tasks, and chats with them via a Discord voice call. Think: AI duo partner that hangs with you while you play.

**Core experience:** You log into Minecraft, the agent spawns next to you, joins your Discord call, and you just... play together. It talks, it helps, it learns your playstyle over sessions.

## Stack Overview

| Layer | Tech | Why |
|---|---|---|
| Agent runtime | Hermes Agent (Nous Research) | Self-improving, skill creation loop, built-in Discord + MCP support |
| Underlying model | Claude (via Hermes' model-agnostic config) | Vision + reasoning quality |
| MC bot | Mineflayer (Node.js) | Mature, structured game state, pathfinder built-in |
| MC interaction | MCP server (our code) | Exposes Mineflayer actions as tools Hermes can call |
| Voice/chat layer | Hermes' Discord platform plugin | Don't reinvent voice receive/TTS |
| Landing page | Next.js or Astro (TBD) | Standard marketing site |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   Your Machine (or VPS)                      │
│                                                              │
│  ┌──────────────┐  MCP   ┌─────────────────┐  protocol      │
│  │ Hermes Agent │ ─────► │  Our MCP Server │ ──────────┐    │
│  │  (external)  │        │  (packages/...)  │           │    │
│  └──────┬───────┘        └────────┬─────────┘           │    │
│         │                         │                     │    │
│         │ Discord plugin          │ controls            ▼    │
│         │                         ▼               ┌────────┐ │
│         │                  ┌────────────┐         │   MC   │ │
│         │                  │ Mineflayer │ ──────► │ Server │ │
│         │                  │   Bot      │         └────────┘ │
│         │                  └────────────┘              ▲     │
│         │                                              │     │
└─────────┼──────────────────────────────────────────────┼─────┘
          │                                              │
          ▼                                              │
   ┌─────────────┐                                  ┌─────────┐
   │  Discord    │                                  │  Human  │
   │ Voice Chan  │ ◄──── voice call ─────────────── │ Player  │
   └─────────────┘                                  └─────────┘
```

**Key principle:** Hermes is *external*. It's installed separately and configured to talk to our MCP server. Our repo never imports Hermes code.

## The Two-Loop Design (CRITICAL)

The bot has **two loops running in parallel**. This is the most important architectural decision in the whole project.

### Fast loop (10-20Hz, no LLM)
- Runs in our `mc-bot` app, pure code
- Tracks player position
- Pathfinds to stay in proximity (see Follow Behavior below)
- Reactive safety: dodge mobs, eat when hungry, avoid lava
- Idle look-at-player when stationary
- **Latency budget: 50-100ms per tick**

### Slow loop (every 3-5s, OR on event)
- Sends compact JSON game state to Claude (via Hermes)
- Decides: should I chat? Invoke a skill? Comment on something?
- Output: high-level intent → queued for fast loop / skill executor
- **Latency budget: ~1s response, but doesn't block bot presence**

The fast loop is what makes the bot feel *alive* even while Claude is thinking. Never put the LLM in the hot path of "am I standing in lava."

## Follow Behavior Spec

Bot maintains presence near player via a state machine:

```
State: IDLE       → distance to player
  if dist > 10    → state = CATCHUP (sprint pathfind to 3-block radius)
  if dist > 5     → state = DRIFT (chill pathfind to 3-block radius)  
  if dist ≤ 5     → stay, look at player, small idle movements
  if acting       → state = TASK (move up to 10, do thing, return)
```

**Rules:**
- **Hysteresis:** once following, target 3 blocks but don't recompute until drift past 4. Prevents jitter.
- **Predictive following:** path to `player_pos + velocity * 0.5`, not current pos.
- **Personal space:** ~1.5 block avoidance radius around player. Don't path through them.
- **Teleport fallback:** if dist > 30 (portal, sprint, fall), `/tp` instead of pathfinding.
- **Verticality:** carry scaffolding blocks, `placeBlock` to follow up. Or `/tp` if not picky.

## State Extraction (No-Vision-First)

Vision is expensive. Mineflayer gives us perfect structured state for free. **Prefer structured state to screenshots in 95%+ of cases.**

Every tick, we can grab:
```
- bot.entity.position, velocity
- bot.players[username].entity.position
- bot.nearestEntity() filtered by hostile mobs
- bot.blockAt(pos), bot.findBlocks() for terrain
- bot.inventory.items()
- bot.health, bot.food
- bot.time.timeOfDay
- chat messages from player
```

We compact this into a JSON state object passed to Claude on every slow-loop tick.

### When to actually use screenshots

Vision (screenshot of bot's POV or player's screen) only fires on:
- Player says "look at this" / "what do you think" / "check this out"
- Player stationary + looking at non-air block for 2s ("pointing" heuristic)
- Confusing situations structured state misses (redstone, signs, paintings, builds)
- Periodic vibe check every ~60s for aesthetic commentary

Goal: maybe 1 image every couple minutes. Everything else is text.

## Skills (Hermes Skill Loop)

Hermes auto-generates and improves "skills" - reusable markdown files describing how to do things. We seed it with a base set:

- `follow_player(distance)` - the state machine above
- `assist_mining()` - mine adjacent blocks when player mines
- `combat_assist()` - flank mobs the player is fighting
- `fetch_item(name)` - retrieve known items from known chests
- `scout_ahead(distance)` - path ahead in player's heading, report findings
- `build_helper(spec)` - place blocks per a pattern
- `inventory_report()` - summarize what we have

Hermes will add to this list as we play. Skills are stored as MD files in Hermes' state dir, not our repo.

## Repo Structure (Monorepo)

```
your-project/
├── README.md
├── package.json              # bun workspaces
├── .env.example
│
├── apps/
│   ├── web/                  # landing page (Next.js/Astro TBD)
│   └── mc-bot/               # Mineflayer bot runtime
│       └── src/
│           ├── index.ts
│           ├── fast-loop/    # follow SM, reactive safety
│           ├── slow-loop/    # event triggers, Claude orchestration
│           ├── skills/       # skill implementations
│           ├── state/        # game-state extraction → JSON
│           └── config.ts
│
├── packages/
│   ├── mcp-server/           # MCP server Hermes connects to
│   │   └── src/
│   │       ├── tools/        # move_to, mine, place, etc.
│   │       ├── resources/    # state snapshots Hermes reads
│   │       └── server.ts
│   ├── shared/               # types, schemas, prompts
│   └── (discord-bridge removed — no voice module any more)
│
├── infra/
│   ├── docker-compose.yml    # local dev stack
│   └── deploy/
│
├── docs/
└── scripts/
```

**Where Hermes lives:** NOT in this repo. Installed separately (`curl ... install.sh`), configured to point at our MCP server URL. We expose tools; Hermes consumes them.

## Latency Budget

| Pipeline | Target | Approach |
|---|---|---|
| Fast loop tick | 50-100ms | Pure code, no I/O |
| Slow loop decision | ~1s | Text-only state to Claude |
| Voice in → out | <2s e2e | Streaming TTS, VAD turn-taking |
| Vision call | 2-3s OK | Rare, on-demand only |

## Personality / Vibes

Not a coach. Not a tutorial bot. A *friend*.
- Casual, conversational
- Slightly hyped about cool things
- Salty when appropriate
- Doesn't lecture
- Remembers your tilt patterns, comp preferences, base locations
- Mostly quiet, talks when prompted or when something genuinely warrants comment

System prompt should lean into this. Avoid "I am an AI assistant" energy entirely.

## Open Decisions

- [ ] Landing page framework: Next.js vs Astro
- [ ] Voice in Discord: confirm Hermes' Discord plugin handles voice receive + TTS, or DIY via `discord.js` + Deepgram + ElevenLabs
- [ ] MC server: local Paper/Fabric for dev, what for prod?
- [ ] Bot account: dedicated MC account vs offline-mode server
- [ ] How to handle multiple humans in the call (filter by user ID?)
- [ ] Memory persistence: rely on Hermes' SQLite, or add our own structured memory for MC-specific stuff (base coords, chest contents, etc.)

## Anti-Patterns / Things NOT To Do

- ❌ Don't put LLM calls in the fast loop - kills presence
- ❌ Don't use computer-use/screenshots when Mineflayer state suffices
- ❌ Don't fork Hermes - depend on it via MCP
- ❌ Don't build a web dashboard for the bot before it's actually good
- ❌ Don't make the bot proactively chatty - it should mostly listen
- ❌ Don't pathfind for long routes (>30 blocks) - teleport instead
- ❌ Don't reason from pixels when structured state is available

## Quick Start (Future)

```bash
# 1. Install Hermes
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash

# 2. Clone this repo
git clone <repo> && cd <repo>
bun install

# 3. Configure
cp .env.example .env
# fill in: MC_SERVER_HOST, DISCORD_TOKEN, ANTHROPIC_API_KEY, etc.

# 4. Spin up local MC + bot + MCP server
bun run bot

# 5. Point Hermes at our MCP server
hermes mcp add minecraft-buddy http://localhost:3001

# 6. Enable Discord platform in Hermes, join voice channel
hermes platform discord enable
```

## Glossary

- **Hermes / Hermes Agent:** the autonomous AI agent framework from Nous Research that we use as our runtime
- **MCP (Model Context Protocol):** Anthropic's protocol for connecting tools/data to LLMs; how our bot exposes itself to Hermes
- **Mineflayer:** Node.js Minecraft bot library
- **Fast loop / slow loop:** our two-loop architecture (see above)
- **Skill:** a markdown file Hermes uses as a learned behavior pattern
