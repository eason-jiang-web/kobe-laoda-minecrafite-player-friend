/**
 * 指令栏访问策略。
 *
 * 让 AI 用 / 指令很爽（/time set day、/weather clear、/give eason diamond），
 * 但**不加限制的指令权限等于把世界交给一个喝多了的兄弟**：
 *   /fill ~ ~ ~ ~10 ~10 ~10 air   把房子填平
 *   /kill @e                      清场（包括你）
 *   /stop                         关掉服务器
 *   /op someone                   提权
 *
 * 所以：**默认只放行一批安全又有用的指令**，玩家可以用 MC_ALLOW_COMMANDS 改，
 * 或者设成 * 全部放行（文档里写明这是危险操作）。
 */

/** 默认放行：氛围、广播、送礼、召唤 —— 都是"好玩但拆不了家"的。 */
export const DEFAULT_ALLOWED_COMMANDS = [
  "time",
  "weather",
  "say",
  "me",
  "list",
  "seed",
  "difficulty",
  "summon",
  "give",
] as const;

/** 解析 MC_ALLOW_COMMANDS。空 = 用默认；"*" = 全部放行。 */
export function parseAllowedCommands(raw: string | undefined): string[] | "*" {
  const text = (raw ?? "").trim();
  if (text === "*") return "*";
  if (text.length === 0) return [...DEFAULT_ALLOWED_COMMANDS];
  return text
    .split(",")
    .map((c) => c.trim().replace(/^\/+/, "").toLowerCase())
    .filter(Boolean);
}

/** 把玩家/模型写的东西变成干净的一条指令（去掉斜杠和多余空白）。 */
export function normalizeCommand(input: string): string {
  return input.trim().replace(/^\/+/, "").replace(/\s+/g, " ");
}

/** 这条指令的**动词**（第一条词），大小写不敏感。 */
export function commandVerb(command: string): string {
  return normalizeCommand(command).split(" ")[0]?.toLowerCase() ?? "";
}

export interface CommandVerdict {
  ok: boolean;
  /** 拒绝时给模型看的原因（要能自己纠正）。 */
  reason?: string;
  command: string;
}

export function checkCommand(input: string, allowed: string[] | "*"): CommandVerdict {
  const command = normalizeCommand(input);
  if (command.length === 0) {
    return { ok: false, command, reason: "空的指令" };
  }
  if (allowed === "*") return { ok: true, command };

  const verb = commandVerb(command);
  if (allowed.includes(verb)) return { ok: true, command };

  return {
    ok: false,
    command,
    reason:
      "这条指令没在放行名单里（现在能用：" +
      allowed.join(", ") +
      "）。需要的话让 eason 改 .env 里的 MC_ALLOW_COMMANDS（或者写成 * 全部放行，但那样它能拆家）。",
  };
}
