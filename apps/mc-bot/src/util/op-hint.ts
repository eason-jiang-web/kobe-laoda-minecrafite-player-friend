/**
 * "自己给自己 op" 这件事的文案与判定。
 *
 * 背景：Minecraft 里玩家不能给自己 op —— 这是服务端的权限设计，不是 bug。
 * 所以开机那条 /op 注定被拒；它的价值在于**被拒之后**：机器人在游戏里说一句
 * 人话，告诉你两条真正能用的路（手打一次 / 或者关掉世界双击脚本）。
 * 玩家在游戏里，终端不一定在看，所以这句话必须留在游戏里。
 */

/** 服务端的拒绝话术（英文原版 + 常见中文客户端/插件）。 */
const DENIED = /permission|not allowed|denied|权限|不允许|未知|unknown command/i;

export function isOpDenied(reply: string): boolean {
  return DENIED.test(reply);
}

export type TpReply = "ok" | "denied" | "notfound" | "unknown";

/**
 * 服务端对 `/tp` 的回话分三类。
 *
 * 为什么要分类：失败时服务端**不用统一措辞** ——
 * 权限不够是 "You do not have permission to use this command"，
 * 名字不存在是 **"No entity was found"**（注意不是 "not found"：
 * 第一版正则写的是 /not found/，于是把这句失败报成了成功 —— 实测抓到的）。
 *
 * 所以成功要认 **"Teleported"** 这个正面标志，而不是"没看到错误就算成功"。
 */
export function classifyTpReply(reply: string): TpReply {
  if (DENIED.test(reply)) return "denied";
  if (/no entity|was found|no player|not found|不存在|找不到/i.test(reply)) return "notfound";
  if (/teleport/i.test(reply)) return "ok";
  return "unknown";
}

/**
 * 被拒之后在游戏里说的那一句。
 *
 * 必须是单行、够短（Minecraft 聊天栏 256 字符），并且**不催**：
 * 没 op 也能正常玩，只是远路要自己走。
 */
export function opHint(bot: string, owner: string): string {
  return (
    "【提示】想让我瞬移、远路抄近道，得先给我 op：" +
    owner +
    " 在聊天栏打一次 /op " +
    bot +
    "；或者关掉世界后双击「给牢大开权限.cmd」。不急 —— 不开我也能跟着你、挖矿打怪，就是走得慢点。"
  );
}
