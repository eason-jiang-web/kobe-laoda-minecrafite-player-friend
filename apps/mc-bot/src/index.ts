import { mkdirSync } from "node:fs";
import { createMcpServer, serveHttp } from "@itto/mcp-server";
import { loadConfig } from "./config.js";
import { createBot, onBotDead } from "./bot/create-bot.js";
import { BotController } from "./bot/controller.js";
import { FastLoop } from "./fast-loop/index.js";
import { SlowLoop, consoleNudgeSink } from "./slow-loop/index.js";
import { createAgentBrainSink } from "./slow-loop/agent-sink.js";
import { GoalRunner } from "./slow-loop/goal-runner.js";
import { registerGoalTools } from "./slow-loop/goal-tools.js";
import { registerSkillTools, runSkillByName } from "./skills/index.js";
import type { SkillContext } from "./skills/types.js";
import { WorldMemory } from "./memory/store.js";
import { registerMemoryTools } from "./memory/tools.js";
import { pushChat } from "./state/extract.js";
import { setLogLevel, logger } from "./util/logger.js";

const log = logger("main");

/**
 * Boot sequence — this is where the whole machine comes together:
 *
 *   1. spawn the Mineflayer bot
 *   2. wrap it in a BotController (the single control surface)
 *   3. start the fast loop (15Hz follow + safety, pure code)
 *   4. start the slow loop (~4s trigger detection → nudges to Hermes)
 *   5. stand up the MCP server over HTTP so Hermes can connect + drive it
 *
 * Hermes itself runs SEPARATELY and connects to the MCP endpoint. It owns the
 * model + Discord voice. We just expose the body and the senses.
 */
async function main() {
  const cfg = loadConfig();
  setLogLevel(cfg.logLevel);
  log.info("booting itto…");

  // 1 + 2
  const bot = await createBot(cfg);
  const controller = new BotController(bot, cfg);

  // world memory: MC-specific spatial facts (waypoints, chest index). Survives
  // reconnects + restarts. Persisted to data/world.db at the repo root.
  mkdirSync("data", { recursive: true });
  const memory = new WorldMemory("data/world.db");

  // 3 — fast loop owns the follow controller; the state extractor reads its state
  const fast = new FastLoop(bot, cfg);
  fast.start();

  // skills context + the goal runner (executes the brain's multi-step intents)
  const skillCtx: SkillContext = {
    control: controller,
    memory,
    suspendFollow: () => fast.follow.suspend(),
    resumeFollow: () => fast.follow.resume(),
  };
  const runner = new GoalRunner({
    control: controller,
    runSkill: (name, args) => runSkillByName(skillCtx, name, args),
    suspendFollow: () => fast.follow.suspend(),
    resumeFollow: () => fast.follow.resume(),
    onComplete: (goal) => slow.notifyGoalComplete(goal),
  });

  // stamp live followState + currentGoal onto every snapshot
  const origGetState = controller.getState.bind(controller);
  controller.getState = () => {
    const g = runner.currentGoal();
    const lg = runner.lastGoalFinished();
    return {
      ...origGetState(),
      followState: fast.followState(),
      currentGoal: g ? { id: g.id, label: g.label, status: g.status, progress: g.progress } : null,
      lastGoal: lg ? { id: lg.id, label: lg.label, status: lg.status, progress: lg.progress } : null,
    };
  };

  // 4 — slow loop. The sink routes "nudges" (something worth reacting to) to
  // the brain: an external agent when configured, else just log.
  const sink =
    cfg.brain.enabled && cfg.brain.cmd.length > 0
      ? createAgentBrainSink({ cmd: cfg.brain.cmd, dir: cfg.brain.dir, cooldownMs: cfg.brain.cooldownMs })
      : consoleNudgeSink;
  if (cfg.brain.enabled) log.info("brain: external agent");
  const slow = new SlowLoop(controller, cfg, sink, runner, memory);
  slow.start();

  // 5 — MCP server: a fresh instance per connecting session (brain, voice,
  // dev driver), all wired to the same controller/memory/runner. An McpServer
  // binds exactly one transport, so serveHttp calls this factory per session.
  const buildMcp = () => {
    const mcp = createMcpServer(controller);
    registerSkillTools(mcp, skillCtx);
    registerMemoryTools(mcp, memory, controller);
    registerGoalTools(mcp, runner);
    return mcp;
  };

  const http = await serveHttp(buildMcp, { host: cfg.mcp.host, port: cfg.mcp.port });
  log.info("itto is live. point the brain at the MCP endpoint and join the call.");

  // ── connection lifecycle + auto-reconnect ──
  // The MCP server, world memory, and loops persist across reconnects; only the
  // mineflayer Bot is recreated and rebound, so the brain's session survives.
  let activeBot = bot;
  let reconnecting = false;

  const onChat = (username: string, message: string) => {
    if (username === activeBot.username) return;
    pushChat(username, message);
    slow.poke();
  };

  const handleDead = async (reason: string) => {
    if (reconnecting) return;
    reconnecting = true;
    log.warn(`connection lost (${reason})`);
    fast.stop();
    slow.stop();
    runner.cancel();
    if (!cfg.reconnect.enabled) {
      log.warn("reconnect disabled — exiting");
      memory.close();
      await http.close();
      process.exit(1);
    }
    let delay = cfg.reconnect.delayMs;
    for (;;) {
      log.info(`reconnecting in ${Math.round(delay / 1000)}s…`);
      await new Promise((r) => setTimeout(r, delay));
      try {
        const nb = await createBot(cfg);
        controller.rebind(nb);
        fast.rebind(nb);
        wireConnection(nb);
        fast.start();
        slow.start();
        reconnecting = false;
        log.info("reconnected.");
        return;
      } catch (e) {
        log.warn(`reconnect failed: ${(e as Error).message}`);
        delay = Math.min(delay * 2, cfg.reconnect.maxDelayMs);
      }
    }
  };

  function wireConnection(b: typeof bot): void {
    activeBot = b;
    b.on("chat", onChat);
    onBotDead(b, (reason) => void handleDead(reason));
  }

  wireConnection(bot);

  // graceful shutdown
  const shutdown = async () => {
    log.info("shutting down…");
    reconnecting = true; // don't try to reconnect while quitting
    fast.stop();
    slow.stop();
    await http.close();
    memory.close();
    activeBot.quit();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  log.error("fatal:", e);
  process.exit(1);
});
