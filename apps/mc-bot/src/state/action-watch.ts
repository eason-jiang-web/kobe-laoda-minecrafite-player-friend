/**
 * 把"他做了什么"翻译成动作事件。
 *
 * 两类来源：
 *   ① mineflayer 事件 —— 他被打、他捡起东西、他完成进度
 *   ② 服务器播报文字 —— 死亡、睡觉、上下线（这些没有事件，只有聊天栏那一行）
 *
 * 只关心**他**（MC_OWNER_USERNAME）：别人进出、别人捡东西都不叫醒大脑。
 * 不认识的名字/拿不到的字段一律安静跳过 —— 这是锦上添花的功能，不能因为它报错。
 */
import type { Bot } from "mineflayer";
import { itemKnowledge, itemNameZh } from "@itto/shared";
import { logger } from "../util/logger.js";
import { classifySystemLine } from "./action-classify.js";
import { recordPlayerAction, type PlayerAction } from "./player-actions.js";

const log = logger("actions");

export interface ActionWatchOptions {
  /** 只关心这个人的动作。 */
  owner: string;
  /** 可注入，测试里换成假的记录器。 */
  record?: (action: Omit<PlayerAction, "at">) => void;
}

export function watchPlayerActions(bot: Bot, opts: ActionWatchOptions): void {
  const owner = opts.owner;
  const record = opts.record ?? recordPlayerAction;
  const isOwner = (name: unknown): boolean =>
    typeof name === "string" && name.length > 0 && name.toLowerCase() === owner.toLowerCase();

  // ① 他被打（看不清他剩多少血 —— mineflayer 不暴露别人的血量 —— 但"刚被打了"本身就值得反应）
  bot.on("entityHurt", (entity) => {
    try {
      if (!isOwner((entity as { username?: string }).username)) return;
      record({
        kind: "hurt",
        important: true,
        text: "他刚被打了 —— 先看一眼是不是有怪贴着他（nearbyHostiles/周围），该还手就还手，该扔吃的就扔吃的。",
      });
    } catch {
      // 忽略
    }
  });

  // ② 他捡起东西（只报"值得说一句"的：稀有/珍贵级别）
  bot.on("playerCollect", (collector, collected) => {
    try {
      if (!isOwner((collector as { username?: string }).username)) return;
      let name = "";
      let count = 1;
      const item = (collected as { getDroppedItem?: () => { name: string; count: number } | null })
        .getDroppedItem?.();
      if (item) {
        name = item.name;
        count = item.count;
      }
      if (name.length === 0) return;
      const tier = itemKnowledge(name).tier;
      if (tier !== "relic" && tier !== "precious") return;
      record({
        kind: "pickup",
        important: true,
        text: "他刚捡到 " + itemNameZh(name) + "×" + count + " —— 值得夸一句（他是真去挖了）。",
      });
    } catch {
      // 忽略
    }
  });

  // ③ 他完成进度
  // 注："advancement" 在 mineflayer 的类型定义里没有（运行时会 emit），所以绕过类型。
  bot.on("advancement" as never, ((advancement: unknown) => {
    try {
      const raw = advancement as { displayName?: unknown; title?: unknown };
      const name = String(raw.displayName ?? raw.title ?? "").trim();
      record({
        kind: "advancement",
        important: true,
        text:
          "他完成了进度「" + (name || "某个进度") + "」—— 恭喜一下（顺嘴可以点一句下一步大概要干嘛）。",
      });
    } catch {
      // 忽略
    }
  }) as never);

  // ④ 他丢东西 —— 大概率是给你的（"把这个拿着"）。判据：掉落物出现在他脚边。
  //    没有对应事件能告诉我们"谁丢的"，所以用距离近似：在他 6 格内冒出来的掉落物，
  //    基本就是他丢的（怪物掉落/自然生成很少正好落在他脚边）。
  bot.on("itemDrop", (entity) => {
    try {
      const owner = bot.players[opts.owner]?.entity;
      if (!owner) return;
      const pos = (entity as { position?: { distanceTo?: (v: unknown) => number } }).position;
      if (!pos?.distanceTo) return;
      if (pos.distanceTo(owner.position) > 6) return;

      let name = "";
      let count = 1;
      const item = (entity as { getDroppedItem?: () => { name: string; count: number } | null })
        .getDroppedItem?.();
      if (item) {
        name = item.name;
        count = item.count;
      }
      if (name.length === 0) return;
      record({
        kind: "drop",
        text:
          "他刚丢下了 " + itemNameZh(name) + "×" + count +
          "（就在他脚边）—— 多半是给你的：确认一下是不是要你拿着，是的话走过去捡起来，然后说一句收到了。",
      });
    } catch {
      // 忽略
    }
  });

  // ⑤ 服务器播报：死亡 / 睡觉 / 上下线（只认他）
  bot.on("message", (msg) => {
    try {
      const hit = classifySystemLine(String(msg), owner);
      if (hit) record({ kind: hit.kind, text: hit.text, important: hit.important });
    } catch (e) {
      log.debug("播报解析失败：" + (e as Error).message);
    }
  });
}
