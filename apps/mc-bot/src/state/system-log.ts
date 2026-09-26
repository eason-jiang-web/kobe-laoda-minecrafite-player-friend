/**
 * 服务器的"嘴"：指令执行结果（"Set the time to day"）、报错（"Unknown command"）、
 * 玩家进出。留一个很小的环形缓冲，好让 run_server_command 知道
 * **自己发的指令到底成没成** —— 不然模型就是在盲发指令。
 */
const lines: Array<{ text: string; at: number }> = [];
const MAX = 24;

export function pushSystem(text: string): void {
  const t = text.trim();
  if (t.length === 0) return;
  lines.push({ text: t, at: Date.now() });
  while (lines.length > MAX) lines.shift();
}

/** 比 `since` 新的那几条（发指令前记个时间戳，发完读这一段）。 */
export function systemSince(since: number, limit = 3): string[] {
  return lines
    .filter((l) => l.at >= since)
    .slice(-limit)
    .map((l) => l.text);
}
