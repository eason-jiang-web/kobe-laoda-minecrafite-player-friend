import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateItem, type GameState } from "@itto/shared";
import { matchCommand, type CommandContext } from "./chat-commands.js";
import { clearCap, currentCaps, knownKeys, resolveItemKey, setCap } from "./value-caps.js";

function state(pairs: Array<[string, number]>): GameState {
  return {
    inventory: pairs.map(([name, count]) => ({ name, count })),
    players: ["eason"],
    valueCaps: currentCaps(),
  } as unknown as GameState;
}

function harness(inventory: Array<[string, number]>) {
  const ctx = {
    control: { getState: () => state(inventory) },
    follow: {},
    runner: {},
  } as unknown as CommandContext;
  return ctx;
}

const run = (line: string, ctx: CommandContext) => {
  const hit = matchCommand(line);
  if (!hit) throw new Error("not a command: " + line);
  return hit.command.run(ctx, hit.arg);
};

describe("resolveItemKey — 中文也能认", () => {
  test("chinese names map to the resource group", () => {
    expect(resolveItemKey("铁")).toBe("iron");
    expect(resolveItemKey("铁锭")).toBe("iron");
    expect(resolveItemKey("钻石")).toBe("diamond");
    expect(resolveItemKey("下界合金")).toBe("netherite");
    expect(resolveItemKey("木头")).toBe("wood");
  });

  test("item ids pass straight through", () => {
    expect(resolveItemKey("raw_iron")).toBe("raw_iron");
    expect(resolveItemKey("DIAMOND")).toBe("diamond");
  });

  test("gibberish is rejected", () => {
    expect(resolveItemKey("瞎写的")).toBeNull();
    expect(resolveItemKey("")).toBeNull();
  });
});

describe("#value 改上限（落盘）", () => {
  const dir = mkdtempSync(join(tmpdir(), "itto-caps-"));
  process.env.MC_VALUE_CAPS_FILE = join(dir, "caps.json");

  test("starts empty", () => {
    expect(currentCaps()).toEqual({});
  });

  test("#value 铁 400 sets iron's cap and says so", async () => {
    const reply = await run("#value 铁 400", harness([["raw_iron", 400]]));
    expect(reply).toContain("上限改成 400");
    expect(currentCaps()).toEqual({ iron: 400 });
  });

  test("the new cap actually changes the judgement", () => {
    // 默认每人 100 → 400 铁是溢出的；改成 400 之后就不溢出了
    const withDefault = evaluateItem("raw_iron", 400, {
      inventory: [{ name: "raw_iron", count: 400 }],
      players: ["eason"],
    } as unknown as GameState);
    expect(withDefault.verdict).toBe("overflow");

    const withCustom = evaluateItem("raw_iron", 400, state([["raw_iron", 400]]));
    expect(withCustom.verdict).not.toBe("overflow");
    expect(withCustom.customCap).toBe(true);
    expect(withCustom.cap).toBe(400);
  });

  test("it survives a reload (written to disk)", () => {
    const raw = readFileSync(process.env.MC_VALUE_CAPS_FILE!, "utf8");
    expect(JSON.parse(raw)).toEqual({ iron: 400 });
  });

  test("#value 铁 0 means unlimited", async () => {
    const reply = await run("#value 铁 0", harness([["raw_iron", 9999]]));
    expect(reply).toContain("不限量");
    expect(evaluateItem("raw_iron", 9999, state([["raw_iron", 9999]])).verdict).toBe("unlimited");
  });

  test("#value 铁 默认 restores the default table", async () => {
    await run("#value 铁 400", harness([["raw_iron", 400]]));
    const reply = await run("#value 铁 默认", harness([["raw_iron", 400]]));
    expect(reply).toContain("还原");
    expect(currentCaps()).toEqual({});
  });

  test("a bad number is refused", async () => {
    expect(await run("#value 铁 很多", harness([]))).toContain("不是个数字");
  });

  test("an unknown item explains what can be tuned", async () => {
    const reply = await run("#value 瞎写的 10", harness([]));
    expect(reply).toContain("不认识");
    expect(reply).toContain("iron");
  });

  test("#value 铁 (one arg) reports without changing anything", async () => {
    const before = { ...currentCaps() };
    const reply = await run("#value 铁", harness([["raw_iron", 30]]));
    expect(reply).toContain("铁");
    expect(reply).toContain("上限");
    expect(currentCaps()).toEqual(before);
  });

  test("#value with no args still gives the overview", async () => {
    const reply = await run("#value", harness([["diamond", 5]]));
    expect(reply).toContain("不催你");
  });

  test("cleanup", () => {
    clearCap("iron");
    expect(knownKeys()).toContain("iron");
    rmSync(dir, { recursive: true, force: true });
  });
});
