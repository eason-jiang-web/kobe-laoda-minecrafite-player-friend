import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RunSkillInput, type BotControl } from "@itto/shared";
import type { Skill, SkillContext } from "./types.js";
import { followPlayer } from "./follow-player.js";
import { assistMining, mineVein } from "./assist-mining.js";
import { chopTree } from "./chop-tree.js";
import { collectDrops } from "./collect-drops.js";
import { combatAssist } from "./combat-assist.js";
import { fetchItem } from "./fetch-item.js";
import { scoutAhead } from "./scout-ahead.js";
import { buildHelper } from "./build-helper.js";
import { inventoryReport } from "./inventory-report.js";
import { logger } from "../util/logger.js";

const log = logger("skills");

/** The seed skill set. Hermes can author more as markdown in its own state. */
export const SKILLS: Skill[] = [
  followPlayer,
  assistMining,
  mineVein,
  chopTree,
  collectDrops,
  combatAssist,
  fetchItem,
  scoutAhead,
  buildHelper,
  inventoryReport,
];

const REGISTRY = new Map(SKILLS.map((s) => [s.name, s]));

/**
 * Run a skill by name. The single execution path used by BOTH the `run_skill`
 * MCP tool and the goal runner — so there's one place skills actually fire.
 * Throws on unknown skill or skill failure; callers wrap as they need.
 */
export async function runSkillByName(
  ctx: SkillContext,
  name: string,
  args?: Record<string, unknown>,
): Promise<string> {
  const skill = REGISTRY.get(name);
  if (!skill) throw new Error(`unknown skill: ${name}`);
  return skill.run(ctx, args);
}

/**
 * Register the `run_skill` tool on the MCP server. Skills live in the app
 * (they need the follow controller), so we add this tool here rather than in
 * the mcp-server package — keeps that package free of app concerns.
 */
export function registerSkillTools(server: McpServer, ctx: SkillContext): void {
  server.tool(
    "run_skill",
    `Run a composite skill. Available: ${SKILLS.map((s) => s.name).join(", ")}.`,
    RunSkillInput.shape,
    async ({ name, args }) => {
      try {
        const result = await runSkillByName(ctx, name, args);
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, message: result }) }] };
      } catch (e) {
        log.error(`skill ${name} failed`, (e as Error).message);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ok: false, message: (e as Error).message }) }],
          isError: true,
        };
      }
    },
  );
}

export type { Skill, SkillContext, BotControl };
