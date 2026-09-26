import { describe, expect, test } from "bun:test";
import { connectWithRetry, shouldExplain } from "./connect-retry.js";

/** 记下每次等待了多久，不真的等。 */
function fakeSleep(log: number[]) {
  return async (ms: number) => {
    log.push(ms);
  };
}

describe("connectWithRetry — 先开窗口再开世界也不该死", () => {
  test("keeps trying until it gets in", async () => {
    let tries = 0;
    const slept: number[] = [];
    const bot = await connectWithRetry({
      connect: async () => {
        tries += 1;
        if (tries < 3) throw new Error("ECONNREFUSED 127.0.0.1:25565");
        return "in the world";
      },
      onFail: () => {},
      retry: true,
      delayMs: 100,
      maxDelayMs: 2000,
      sleep: fakeSleep(slept),
    });
    expect(bot).toBe("in the world");
    expect(tries).toBe(3);
    expect(slept).toEqual([100, 200]); // 退避
  });

  test("backs off but never past the ceiling", async () => {
    const slept: number[] = [];
    let tries = 0;
    await connectWithRetry({
      connect: async () => {
        tries += 1;
        if (tries < 5) throw new Error("nope");
        return "ok";
      },
      onFail: () => {},
      retry: true,
      delayMs: 1000,
      maxDelayMs: 4000,
      sleep: fakeSleep(slept),
    });
    expect(slept).toEqual([1000, 2000, 4000, 4000]);
  });

  test("reports every failure with its reason and the attempt number", async () => {
    const seen: string[] = [];
    let tries = 0;
    await connectWithRetry({
      connect: async () => {
        tries += 1;
        if (tries < 3) throw new Error("ECONNREFUSED");
        return "ok";
      },
      onFail: (e, n) => seen.push(n + "|" + e.message),
      retry: true,
      delayMs: 1,
      maxDelayMs: 1,
      sleep: fakeSleep([]),
    });
    expect(seen).toEqual(["1|ECONNREFUSED", "2|ECONNREFUSED"]);
  });

  test("wraps non-Error throws instead of losing them", async () => {
    const seen: string[] = [];
    let tries = 0;
    await connectWithRetry({
      connect: async () => {
        tries += 1;
        if (tries < 2) throw "just a string";
        return "ok";
      },
      onFail: (e) => seen.push(e.message),
      retry: true,
      delayMs: 1,
      maxDelayMs: 1,
      sleep: fakeSleep([]),
    });
    expect(seen).toEqual(["just a string"]);
  });

  test("with retry disabled it still reports once, then fails fast", async () => {
    let tries = 0;
    const seen: string[] = [];
    await expect(
      connectWithRetry({
        connect: async () => {
          tries += 1;
          throw new Error("bad version");
        },
        onFail: (e) => seen.push(e.message),
        retry: false,
        delayMs: 1,
        maxDelayMs: 1,
        sleep: fakeSleep([]),
      }),
    ).rejects.toThrow("bad version");
    expect(tries).toBe(1);
    expect(seen).toEqual(["bad version"]);
  });
});

describe("shouldExplain", () => {
  test("stays quiet for the first couple of tries, then explains", () => {
    expect(shouldExplain(1)).toBe(false);
    expect(shouldExplain(2)).toBe(false);
    expect(shouldExplain(3)).toBe(true);
    expect(shouldExplain(9)).toBe(true);
  });
});
