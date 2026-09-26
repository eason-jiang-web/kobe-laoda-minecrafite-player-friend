import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { assessFacilities, guideProgress, progressBriefing, STAGES, type BotControl } from "@itto/shared";
import { ok } from "./_util.js";

/**
 * 进度/工程评估。纯计算，不花 token、不碰世界 —— 大脑想知道"现在该干嘛、能盖什么"时调它。
 *
 * 为什么让模型"能问"：自主玩的唤醒提示里已经带了同一段分析，
 * 但模型中途想重新评估（比如刚挖到一堆铁）时，有个工具比让它自己数背包靠谱。
 */
export function registerProgressTools(server: McpServer, control: BotControl): void {
  server.tool(
    "assess_progress",
    "Where the playthrough stands (main-quest stage from the bot's own inventory) and which " +
      "facilities are buildable right now / what they are still missing. Pure computation, free, safe to call often.",
    {},
    async () => {
      const state = control.getState();
      const { stage, index, doneCount } = guideProgress(state);
      const ready = assessFacilities(state).filter((f) => f.ready);
      return ok(progressBriefing(state), {
        stage: stage.id,
        stageTitle: stage.title,
        step: index + 1,
        steps: STAGES.length,
        doneCount,
        ready: ready.map((f) => f.id),
      });
    },
  );
}
