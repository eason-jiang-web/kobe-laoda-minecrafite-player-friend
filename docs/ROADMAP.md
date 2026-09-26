# Roadmap — what to build, in what order, by who

> ⚠️ **上游历史设计文档**：这份写的是项目还在 Hermes + Discord 那套时的样子，
> 配置项和文件名已经和现在的实现不一致了。当前用法看 [README](../README.md) 和
> [PCL_DEEPSEEK_SETUP.md](./PCL_DEEPSEEK_SETUP.md)。架构思路（快慢双循环、MCP 分层）仍然成立。


The spec ([CONTEXT.md](./CONTEXT.md)) says *what* itto is. This says *where to
start* and *who owns what*.

## The big call: Hermes or not?

Hermes is the **brain** — it's swappable. The **body** (`apps/mc-bot`: the bot,
the two loops, follow, state, skills) works the same regardless of what's
driving it. There's exactly one seam between them: the **MCP / `BotControl`
line**.

- **We're using Hermes** because someone is dedicated to owning it. That makes
  the integration unknowns *his* problem and buys voice + self-improving skills.
- If that person ever bails, the body still runs — swap in a standalone
  orchestrator that calls Claude directly (Anthropic SDK) at the same seam.
  Nothing below the line changes.

## Team split (along the seam)

| Owner | Layer | Files | Can test without the other? |
|---|---|---|---|
| **Body owner** | Everything below the MCP line | `apps/mc-bot/{bot,fast-loop,slow-loop,state,skills}` | Yes — run the bot, watch it follow, call tools by hand |
| **Brain owner** | Hermes + everything at/above the line | Hermes config, `packages/shared/prompts.ts`, the nudge channel, voice, memory | Needs a running MCP endpoint to connect to |
| **Landing** | `apps/web` | (owned separately) | n/a — independent |

**The contract between body and brain = `packages/shared` types + the MCP
tool/resource schemas.** Agree on tool names + shapes early, together. After
that you move independently.

Rules:
- One person owns the *whole* body, one owns the *whole* brain. Do **not** split
  the body internally (fast loop vs skills) — too coupled, you'll collide.
- Critical path: the body unblocks the brain. Brain owner has nothing to connect
  to until the MCP server is up with working tools. So the body owner sprints a
  thin slice first (see M0/M1), then both parallelize.
- Both can run the full stack locally (MC server + bot + MCP). "Who runs Hermes"
  is just who's iterating on the brain, not a machine boundary.

## Build order (milestones)

### M0 — It moves (BODY, do this first, ~day 1)
Goal: bot joins your world and follows you. No LLM, no Hermes, no MCP yet.
- `bun install`, fill `.env` (at least `MC_OWNER_USERNAME`), `bun run mc:up`, `bun run bot`
- Debug the follow state machine (`fast-loop/follow.ts`) in a real world: tune
  hysteresis, prediction, teleport-fallback so it doesn't jitter or get stuck
- Confirm safety reflexes (`fast-loop/safety.ts`): lava bail, creeper retreat, auto-eat
- **Done when:** you log in, the bot sticks to you and doesn't die to dumb stuff.
  This is the dopamine hit + proves the foundation.

### M1 — It has hands (BODY + BRAIN start in parallel)
Lock the contract (`packages/shared` + MCP tool schemas), then:
- **Body:** make the real tools solid — `move_to`, `mine_block`, `place_block`,
  `chat`, `run_skill`. Expose clean state via the MCP resources. Make 2-3 skills
  actually work (`assist_mining`, `combat_assist`).
- **Brain:** install Hermes, `hermes mcp add itto http://<body-host>:3001/mcp`,
  get Claude reading state + calling `move_to`/`chat`. Drop in the personality
  prompt from `shared/prompts.ts`.
- **Done when:** you type in MC chat and itto responds + acts via Hermes.

### M2 — It talks + reacts (BRAIN-heavy)
- **Brain:** Discord voice (Hermes plugin), and wire the **nudge channel** so
  itto proactively pipes up (`slow-loop/index.ts → NudgeSink`, currently logs).
  See [HERMES_SETUP.md](./HERMES_SETUP.md).
- **Body:** memory store for MC facts (base coords, chest contents) so
  `fetch_item` works; harder skills (`scout_ahead`, `build_helper`).
- **Done when:** you're in a voice call and itto hangs, comments, helps.

### M3 — It feels alive (BOTH, polish)
- Tune the "mostly quiet, talks when it matters" balance (anti-pattern: chatty)
- Latency pass against the budgets in CONTEXT.md
- Multi-human handling (filter by Discord user ID → MC owner)

## Open decisions to settle as you go
(from CONTEXT.md) prod MC host, bot account (offline vs real), memory
persistence (Hermes SQLite vs our own store), voice (Hermes plugin vs DIY
`packages/discord-bridge` — **已删除**）。
