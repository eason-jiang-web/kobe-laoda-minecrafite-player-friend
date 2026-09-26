import { describe, expect, test } from "bun:test";
import {
  DEFAULT_ALLOWED_COMMANDS,
  checkCommand,
  commandVerb,
  normalizeCommand,
  parseAllowedCommands,
} from "./server-commands.js";

describe("normalizeCommand", () => {
  test("strips slashes and collapses whitespace", () => {
    expect(normalizeCommand("  //time   set   day ")).toBe("time set day");
    expect(normalizeCommand("/weather clear")).toBe("weather clear");
  });
});

describe("parseAllowedCommands", () => {
  test("empty means the safe default", () => {
    expect(parseAllowedCommands(undefined)).toEqual([...DEFAULT_ALLOWED_COMMANDS]);
    expect(parseAllowedCommands("  ")).toEqual([...DEFAULT_ALLOWED_COMMANDS]);
  });

  test("* means everything", () => {
    expect(parseAllowedCommands("*")).toBe("*");
  });

  test("a custom list is cleaned up", () => {
    expect(parseAllowedCommands(" /tp , fill,time ")).toEqual(["tp", "fill", "time"]);
  });
});

describe("checkCommand", () => {
  const allowed = parseAllowedCommands(undefined);

  test("lets the fun-and-harmless stuff through", () => {
    for (const c of ["/time set day", "weather clear", "/say hi", "give eason diamond 3", "/summon cow"]) {
      expect(checkCommand(c, allowed).ok).toBe(true);
    }
  });

  test("refuses the world-wrecking stuff by default", () => {
    for (const c of ["/fill ~ ~ ~ ~20 ~10 ~20 air", "setblock 0 0 0 air", "/kill @e", "stop", "/op Steve", "gamemode creative", "deop Laoda"]) {
      const verdict = checkCommand(c, allowed);
      expect(verdict.ok).toBe(false);
      expect(verdict.reason).toContain("放行名单");
    }
  });

  test("the refusal tells the model what IS allowed", () => {
    const verdict = checkCommand("setblock 1 2 3 stone", allowed);
    expect(verdict.reason).toContain("time");
    expect(verdict.reason).toContain("MC_ALLOW_COMMANDS");
  });

  test("an empty command is refused", () => {
    expect(checkCommand("   ", allowed).ok).toBe(false);
  });

  test("* opens everything (documented as the dangerous setting)", () => {
    expect(checkCommand("fill ~ ~ ~ ~5 ~5 ~5 air", "*").ok).toBe(true);
  });

  test("verb extraction ignores case", () => {
    expect(commandVerb("/TIME set day")).toBe("time");
  });
});
