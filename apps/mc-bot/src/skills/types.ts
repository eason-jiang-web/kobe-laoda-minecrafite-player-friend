import type { BotControl } from "@itto/shared";
import type { WorldMemory } from "../memory/store.js";

/**
 * Skills are composite behaviors built on top of the primitive BotControl
 * actions (move/mine/place/...). They map to the seed skill list in
 * CONTEXT.md. Hermes invokes them via the `run_skill` MCP tool; it may also
 * author NEW skills over time as markdown in its own state dir — those don't
 * live here. These are the hand-written, hot-path ones we ship with.
 */
export interface SkillContext {
  control: BotControl;
  /** MC-specific world memory (chest index, waypoints) — used by fetch_item. */
  memory: WorldMemory;
  /** Pause the follow SM so the bot can go do a task (TASK state). */
  suspendFollow(): void;
  /** Resume following once the task is done. */
  resumeFollow(): void;
}

export interface Skill {
  name: string;
  description: string;
  run(ctx: SkillContext, args?: Record<string, unknown>): Promise<string>;
}

/** Run a skill with follow auto-suspended/resumed around it. */
export async function runWithTask(ctx: SkillContext, body: () => Promise<string>): Promise<string> {
  ctx.suspendFollow();
  try {
    return await body();
  } finally {
    ctx.resumeFollow();
  }
}
