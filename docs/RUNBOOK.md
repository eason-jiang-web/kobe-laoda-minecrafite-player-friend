# Runbook — who runs what

Two roles. Code lives in this repo; **Hermes is installed separately** (not in
the repo, never will be).

```
   YOU (dev)                                 FRIEND (demo host)
   build + test the body, push          pull + run EVERYTHING (incl. Hermes)
   ───────────────────────────          ──────────────────────────────────
   MC server (local)                    MC server (local)
   bot + MCP (local)                    bot + MCP (local)
   your MC client                       Hermes  ← the brain
   no Hermes needed                     his MC client + Discord call
```

The whole stack talks over **localhost** on a single machine, so for solo
testing there's zero networking to deal with.

---

## You — dev loop

You own the body (`apps/mc-bot`). You test it standalone (no Hermes) and push.

```bash
bun install
cp .env.example .env        # set MC_OWNER_USERNAME to YOUR mc name
bun run mc:up               # local MC server on :25565
bun run bot                 # bot + MCP server on :3001
```

- Log into `localhost:25565` with your MC client, confirm the bot follows you.
- Test tools/skills by hand (MCP inspector, or a small script hitting `:3001`).
- When it works: `git push`. That's the whole handoff.

### Fast local loop (offline docker, no brain, no Microsoft auth)

For iterating on the body itself:

```bash
bun run mc:up        # local Paper server (offline mode, bot is op)
bun run bot:dev      # bot in offline mode vs localhost, brain OFF (just logs nudges)
```

Then drive any tool/skill by hand with the MCP client (no brain needed):

```bash
bun run drive list                               # all tools + resources
bun run drive read itto://state/current          # live world snapshot
bun run drive find_blocks '{"name":"any_log"}'   # perception
bun run drive run_skill chop_tree                # run a skill (blocks until done)
bun run drive set_goal '{"intent":{"kind":"skill","name":"chop_tree"},"label":"get wood"}'
```

Long skills (chop/mine) should be driven via `set_goal`, not `run_skill` — the
goal runs in the background and reports completion via the nudge channel, so it
never blocks an MCP request. `bun test` runs the unit suite (memory, geometry,
triggers).

## Friend — demo host

Pulls your code and runs the full integrated stack on his machine.

```bash
git pull                    # body + MCP + these docs (NOT Hermes)
bun install
cp .env.example .env        # set MC_OWNER_USERNAME to HIS mc name
bun run mc:up               # MC server, localhost:25565
bun run bot                 # bot + MCP, localhost:3001

# Hermes — installed separately, see docs/HERMES_SETUP.md
hermes mcp add itto http://localhost:3001/mcp
hermes platform discord enable   # join the voice channel
```

Then he logs into `localhost:25565` and plays. itto spawns, follows, talks in
the call.

## Demo-day checklist (friend)

1. `git pull && bun install` — get the latest body
2. `bun run mc:up` — wait until `:25565` accepts connections
3. `bun run bot` — confirm log says MCP is listening on `:3001`
4. `hermes mcp add itto http://localhost:3001/mcp` — confirm Hermes sees the tools
5. Join the Discord voice channel, enable the Hermes Discord platform
6. Log into MC, verify the bot spawns + follows + responds
7. Demo.

---

## When you play *together* (not solo)

The only time localhost isn't enough. Both human clients must hit the **same MC
server**: whoever hosts it, the other connects to their IP. Easiest is
**Tailscale** (private network, no port forwarding) or same LAN. Hermes still
just points at wherever the MCP server is.
