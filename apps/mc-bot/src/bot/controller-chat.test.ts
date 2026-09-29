import { describe, expect, test } from "bun:test";
import type { Bot } from "mineflayer";
import type { Config } from "../config.js";
import { BotController } from "./controller.js";

/** 只需要一个会记话的假 bot —— chatIfNew 只用得上 bot.chat。 */
function make() {
  const said: string[] = [];
  const bot = { chat: (m: string) => said.push(m), username: "Laoda" } as unknown as Bot;
  const controller = new BotController(bot, {} as Config);
  return { controller, said };
}

describe("chatIfNew —— 大脑主动说话的两道刹车", () => {
  test("正常说话照发", async () => {
    const { controller, said } = make();
    expect(await controller.chatIfNew("砍完了，128 个木头")).toEqual({ ok: true });
    expect(said).toEqual(["砍完了，128 个木头"]);
  });

  test("原样重复：一个字都不发", async () => {
    const { controller, said } = make();
    await controller.chatIfNew("砍完了，128 个木头");
    const again = await controller.chatIfNew("砍完了，128 个木头");
    expect(again.ok).toBe(false);
    expect(again.why).toContain("刚说过");
    expect(said.length).toBe(1);
  });

  test("标点/空格不同也算同一句", async () => {
    const { controller, said } = make();
    await controller.chatIfNew("砍完了，128 个木头。");
    const again = await controller.chatIfNew("砍完了 128 个木头");
    expect(again.ok).toBe(false);
    expect(said.length).toBe(1);
  });

  test("开场白连着用两次就不让说了（实测 24 句里 18 句同一个开头）", async () => {
    const { controller, said } = make();
    await controller.chatIfNew("收到 man，木头凑到 8 根了");
    await controller.chatIfNew("收到 man，东北那两棵树我包了");
    const third = await controller.chatIfNew("收到 man，石头我这就去刨");
    expect(third.ok).toBe(false);
    expect(third.why).toContain("开场白");
    expect(said.length).toBe(2);

    // 换个开头就放行
    expect((await controller.chatIfNew("行，那我去刨石头")).ok).toBe(true);
    expect(said.length).toBe(3);
  });

  test("内容不同、开头也不同：绝不误伤", async () => {
    const { controller, said } = make();
    await controller.chatIfNew("东北边有棵树");
    await controller.chatIfNew("天快黑了，先回基地");
    expect((await controller.chatIfNew("我这就去下矿")).ok).toBe(true);
    expect(said.length).toBe(3);
  });

  test("还是老老实实守聊天栏 256 的上限", async () => {
    const { controller, said } = make();
    await controller.chatIfNew("啊".repeat(400));
    expect(said[0]!.length).toBeLessThanOrEqual(256);
  });

  test("以 / 开头的照样拦住（不能变成偷偷发指令）", async () => {
    const { controller, said } = make();
    await expect(controller.chatIfNew("/fill ~ ~ ~ ~9 ~9 ~9 air")).rejects.toThrow();
    expect(said.length).toBe(0);
  });
});
