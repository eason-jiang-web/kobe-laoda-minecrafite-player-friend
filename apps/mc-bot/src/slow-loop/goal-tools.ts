import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ok, fail } from "@itto/mcp-server";
import { SetGoalInput } from "@itto/shared";
import type { GoalRunner } from "./goal-runner.js";

/**
 * Goal tools — how the brain pursues multi-step work. Instead of doing
 * everything in one nudge, the brain sets a goal and the body pursues it,
 * pinging back on completion. Registered app-side (holds the runner).
 */
export function registerGoalTools(server: McpServer, runner: GoalRunner): void {
  server.tool(
    "set_goal",
    "Set what itto should pursue right now (replaces the current goal). Use this for multi-step work like 'chop a tree' or 'fetch iron' — the body pursues it and pings you when it's done.",
    SetGoalInput.shape,
    async ({ intent, label }) => {
      const goal = runner.setGoal(intent, label);
      return ok(`on it: ${goal.label}`, { id: goal.id, label: goal.label, status: goal.status });
    },
  );

  server.tool(
    "get_goal",
    "Check what itto is currently working on.",
    {},
    async () => {
      const goal = runner.currentGoal();
      if (!goal) return ok("no current goal", null);
      return ok(`${goal.label} [${goal.status}]${goal.progress ? `: ${goal.progress}` : ""}`, goal);
    },
  );

  server.tool(
    "cancel_goal",
    "Stop whatever itto is currently doing and clear the goal.",
    {},
    async () => {
      runner.cancel();
      return ok("stopped");
    },
  );
}
