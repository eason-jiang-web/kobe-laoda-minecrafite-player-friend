import { describe, expect, test } from "bun:test";
import { classifyTpReply, isOpDenied, opHint } from "./op-hint.js";

describe("isOpDenied", () => {
  test("catches what a vanilla server actually says", () => {
    expect(isOpDenied("You do not have permission to use this command")).toBe(true);
    expect(isOpDenied('Unknown command. Type "/help" for help.')).toBe(true);
    expect(isOpDenied("你没有权限使用该命令")).toBe(true);
  });

  test("does not cry wolf when the command worked", () => {
    expect(isOpDenied("")).toBe(false);
    expect(isOpDenied("Nothing changed. The player is already an operator")).toBe(false);
    expect(isOpDenied("Made Laoda a server operator")).toBe(false);
  });
});

describe("classifyTpReply", () => {
  test("the real success line (copied from the live server)", () => {
    expect(classifyTpReply("Teleported Laoda to -6.500000, 111.000000, 7.500000")).toBe("ok");
  });

  test("the real failure line — 'No entity was found' fooled the first version", () => {
    expect(classifyTpReply("No entity was found")).toBe("notfound");
  });

  test("permission refusal", () => {
    expect(classifyTpReply("You do not have permission to use this command")).toBe("denied");
  });

  test("silence is NOT success — we say so instead of claiming it worked", () => {
    expect(classifyTpReply("")).toBe("unknown");
    expect(classifyTpReply("Something else entirely")).toBe("unknown");
  });
});

describe("opHint", () => {
  test("names the bot and the owner, and both real ways to fix it", () => {
    const hint = opHint("Laoda", "eason");
    expect(hint).toContain("/op Laoda");
    expect(hint).toContain("给牢大开权限.cmd");
    expect(hint).toContain("eason");
  });

  test("fits one chat line and stays single-line (a newline splits the packet)", () => {
    const hint = opHint("Laoda", "eason");
    expect(hint.length).toBeLessThanOrEqual(256);
    expect(hint).not.toContain("\n");
  });

  test("does not nag — it says the bot works fine without op", () => {
    expect(opHint("Laoda", "eason")).toContain("不急");
  });

  test("uses whatever name the bot actually logged in as", () => {
    expect(opHint("MaoNiang", "eason")).toContain("/op MaoNiang");
  });
});
