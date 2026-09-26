import type { GameState } from "@itto/shared";
import { formatStateForPrompt } from "@itto/shared";
import type { NudgeSink } from "./index.js";
import { logger } from "../util/logger.js";

const log = logger("brain");

/**
 * Routes slow-loop "nudges" into an external agent that acts as itto's brain.
 *
 * The agent is invoked as a CLI: we spawn `<cmd...> "<prompt>"` (the prompt
 * appended as the final arg) in `dir`. The agent is expected to run a model
 * that can reach this project's MCP server (itto-mc, :3001) — so it responds
 * by calling the `chat` tool (talk in MC) or acting via move_to/run_skill/etc.
 *
 * The brain stays swappable and this repo stays agnostic: any agent that takes
 * a prompt as a trailing CLI arg and can reach the itto-mc MCP server works.
 * The actual command + directory are configured locally (.env), never committed.
 */
export interface AgentBrainConfig {
  /** argv prefix to invoke the agent; the prompt is appended as the last arg. */
  cmd: string[];
  /** working directory for the spawn (so the agent loads its own config). */
  dir?: string;
  /** min ms between spawns (each is a full model run — not cheap). */
  cooldownMs: number;
  /** Shorter cooldown for priority nudges (someone is talking to you). */
  chatCooldownMs?: number;
}

const PERSONA =
  "你是牢大（游戏内 ID：Laoda），一个在 Minecraft 里罩着兄弟的抽象战神。" +
  "不是助手、不是旁白 —— 是一起玩命、极度护短的兄弟。" +
  "中文、短句、嗓门大，关键时候甩一句「What can I say? Mamba out!」。有话说就说，别憋着；但也别硬找话。";

export function createAgentBrainSink(cfg: AgentBrainConfig): NudgeSink {
  let lastAt = 0;
  let inflight = false;
  /** Newest nudge that arrived while we were busy (newest wins, priority beats ambient). */
  let pending: { reason: string; state: GameState; priority: boolean } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function run(reason: string, state: GameState): Promise<void> {
    lastAt = Date.now();
    inflight = true;

    const prompt = buildPrompt(reason, state);
    try {
      const proc = Bun.spawn([...cfg.cmd, prompt], {
        cwd: cfg.dir,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          // Structured copies of what we're asking about. The brain logs these
          // for its training data without having to parse its own prompt back.
          ITTO_BRAIN_REASON: reason,
          ITTO_BRAIN_STATE: formatStateForPrompt(state),
        },
      });
      // Drain both pipes *while* waiting: an agent that prints more than the
      // pipe buffer holds would otherwise block on write and never exit.
      const [out, err, code] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      if (code !== 0) {
        log.warn(`agent exited ${code}: ${(err || out).trim().slice(0, 300)}`);
      } else {
        const said = out.trim().replace(/\s+/g, " ");
        log.debug(`nudged brain: ${reason}${said ? ` — ${said.slice(0, 300)}` : ""}`);
      }
    } catch (e) {
      log.error("failed to reach the agent brain:", (e as Error).message);
    } finally {
      inflight = false;
    }
  }

  /**
   * A brain turn takes seconds and the cooldown is real, so a nudge landing
   * mid-turn used to be dropped on the floor. Hold the newest one and run it as
   * soon as we're free — "攒到 128 个木头了" is worth hearing even if a creeper
   * got mentioned first.
   */
  function schedule(): void {
    if (timer !== null || inflight) return;
    const cooldown = pending?.priority ? cfg.chatCooldownMs ?? cfg.cooldownMs : cfg.cooldownMs;
    const wait = Math.max(0, cooldown - (Date.now() - lastAt));
    timer = setTimeout(() => {
      timer = null;
      const next = pending;
      pending = null;
      if (next) void run(next.reason, next.state);
    }, wait);
  }

  return {
    async nudge(reason: string, state: GameState, opts?: { priority?: boolean }) {
      const priority = opts?.priority === true;
      const cooldown = priority ? cfg.chatCooldownMs ?? cfg.cooldownMs : cfg.cooldownMs;
      if (inflight || Date.now() - lastAt < cooldown) {
        // Don't overwrite a queued chat reply with ambient noise.
        if (pending === null || priority || !pending.priority) {
          pending = { reason, state, priority };
        }
        log.debug(`brain busy — queued nudge: ${reason}`);
        schedule();
        return;
      }
      await run(reason, state);
    },
  };
}

function buildPrompt(reason: string, state: GameState): string {
  return [
    PERSONA,
    "",
    `刚刚在 Minecraft 世界里发生了一件事，可能值得你反应一下：${reason}`,
    "",
    "World snapshot (a moment old):",
    formatStateForPrompt(state),
    "",
    "怎么行动：",
    "- 这份快照到你手上已经过了一小会儿。动手前先读 `itto://state/current`（实时世界状态）和 `itto://memory/world`（你已经记住的东西：地标、箱子里的物品）。",
    "- 多步的事（砍树、挖矿脉、取东西、打怪）用 `set_goal` 交给身体去做，别自己微操 —— 它做完了会回来找你。上面 goal 那行已经有任务就别重复设。",
    "- 你有眼睛：`find_blocks`（支持 any_log、any_ore 这类别名）、`look_detect`、`nearby_blocks`。动手前先用它们定位。",
    "- 有用的地方用 `remember_location` 记住，箱子用 `index_chest` 记录里面有什么。",
    "- 他在跟你说话就直接回：一两句，别装没听见，也别答非所问。",
    "- 如果这次唤醒写的是「自由活动」，那是让你自己找事做：用 set_goal 排一个（砍树/挖矿/探路/盖东西都行），再跟他说一句你打算干嘛。",
    "- 一次唤醒一般就一句 chat，别把同一个意思换个说法再说一遍。",
    "- 不要在别的平台回复。如果确实没什么值得说的，就什么都不做。",
  ].join("\n");
}
