# Architecture

> ⚠️ **上游历史设计文档**：这份写的是项目还在 Hermes + Discord 那套时的样子，
> 配置项和文件名已经和现在的实现不一致了。当前用法看 [README](../README.md) 和
> [PCL_DEEPSEEK_SETUP.md](./PCL_DEEPSEEK_SETUP.md)。架构思路（快慢双循环、MCP 分层）仍然成立。


The canonical spec is [`./CONTEXT.md`](./CONTEXT.md). This doc maps that spec
onto the actual files so you can find where each idea lives.

## The one diagram to keep in your head

```
   Hermes (EXTERNAL)  ──MCP/HTTP──►  packages/mcp-server  ──►  BotController
   owns Claude + Discord voice          tools + resources         (apps/mc-bot)
                                                                       │
                                          ┌────────────────────────────┤
                                          ▼                            ▼
                                    fast loop (15Hz)            slow loop (~4s)
                                    follow + safety             triggers → nudges
                                          │                            │
                                          ▼                            ▼
                                     Mineflayer  ◄────────────  GameState snapshot
                                       (the body)                (state/extract.ts)
```

## Where everything lives

| Concept (CONTEXT.md) | File(s) |
|---|---|
| Two-loop design | `apps/mc-bot/src/fast-loop/`, `apps/mc-bot/src/slow-loop/` |
| Fast loop tick | `fast-loop/index.ts` |
| Follow state machine | `fast-loop/follow.ts` |
| Reactive safety | `fast-loop/safety.ts` |
| Slow loop / triggers | `slow-loop/index.ts`, `slow-loop/triggers.ts` |
| State extraction (no-vision-first) | `state/extract.ts` |
| The single control surface | `bot/controller.ts` (impl) + `packages/shared/src/control.ts` (interface) |
| MCP tools Hermes calls | `packages/mcp-server/src/tools/` |
| MCP resources Hermes reads | `packages/mcp-server/src/resources/` |
| Seed skills | `apps/mc-bot/src/skills/` |
| Personality / system prompt | `packages/shared/src/prompts.ts` |
| Shared types + schemas | `packages/shared/src/` |
| Landing page | `apps/web/` |
| Local dev MC server | `infra/docker-compose.yml` |

## Dependency direction (don't break this)

```
apps/mc-bot  ──►  packages/mcp-server  ──►  packages/shared
     │                                          ▲
     └──────────────────────────────────────────┘
```

- `shared` depends on nobody (just zod).
- `mcp-server` depends on `shared` only. It never imports Mineflayer or the app —
  it talks to the bot through the `BotControl` interface, injected at runtime.
- `mc-bot` is the composition root: it owns Mineflayer, implements `BotControl`,
  runs the loops, and mounts the MCP server.

## The Hermes boundary

Hermes is **not in this repo** and never will be (CONTEXT.md anti-pattern: don't
fork Hermes). It's installed separately and connects over MCP. The one loose end
is the slow loop's "nudge" path (`slow-loop/index.ts → NudgeSink`): how we
proactively tell Claude "hey, a creeper showed up." Today it logs; wiring it to
Hermes (MCP notification / sampling / webhook) is TODO once we know Hermes'
integration surface. See `docs/HERMES_SETUP.md`.
