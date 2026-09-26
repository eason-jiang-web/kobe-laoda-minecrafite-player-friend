/**
 * 第一次连不上时的重试。
 *
 * 为什么要它：真实用法是"先双击机器人窗口，再进游戏开局域网" —— 顺序反了很正常，
 * 而且「对局域网开放」的端口**默认是随机的**，第一次连不上几乎是常态。
 * 旧行为是 createBot 一失败就 process.exit(1)：窗口留着、机器人没了，
 * 看着像程序坏了。现在改成和断线重连一样一直等（退避到 maxDelayMs），
 * 而且每次失败都把"端口该填多少"说出来。
 */
export interface ConnectRetryOptions<T> {
  /** 真正去连（通常是 createBot）。 */
  connect: () => Promise<T>;
  /** 连不上时叫人 —— 打印原因 + 端口提醒。 */
  onFail: (error: Error, attempt: number) => void;
  /** false = 不重试，第一次失败就把错误抛出去（开发/测试用）。 */
  retry: boolean;
  delayMs: number;
  maxDelayMs: number;
  /** 可注入：测试里用假的 sleep，免得真等。 */
  sleep?: (ms: number) => Promise<void>;
}

export async function connectWithRetry<T>(opts: ConnectRetryOptions<T>): Promise<T> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let delay = opts.delayMs;
  let attempt = 0;

  for (;;) {
    attempt += 1;
    try {
      return await opts.connect();
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      opts.onFail(err, attempt);
      if (!opts.retry) throw err;
      await sleep(delay);
      delay = Math.min(delay * 2, opts.maxDelayMs);
    }
  }
}

/** 第几次失败之后开始说"连不上多半是这几件事"（前面只报错，别一上来就唠叨）。 */
const EXPLAIN_AFTER = 3;

export function shouldExplain(attempt: number): boolean {
  return attempt >= EXPLAIN_AFTER;
}
