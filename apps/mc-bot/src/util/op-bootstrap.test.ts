import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isWorldLoaded, mergeOpsFile, offlineUuid, opsEntry, parseGameDir } from "./op-bootstrap.js";

/**
 * 真实样本 —— 从用户世界里抄出来的 usercache.json。
 * 这不是我编的期望值：是 Minecraft 自己算出来的，所以它能证明
 * offlineUuid() 和服务端算法逐位一致（错一位 op 就白给）。
 */
const REAL: Array<[string, string]> = [
  ["Laoda", "11e82f15-91f1-324a-92ae-e636fdcb3cf6"],
  ["Kobe", "70d67669-cde9-3ed7-a6f4-28b8905d378d"],
  ["MaoNiang", "28d01014-aff1-385d-9f8b-d8fd1b2d3745"],
];

describe("offlineUuid", () => {
  test("matches the UUIDs the real server wrote into usercache.json", () => {
    for (const [name, expected] of REAL) {
      expect([name, offlineUuid(name)]).toEqual([name, expected]);
    }
  });

  test("is a v3 UUID and is case/whitespace sensitive like the server", () => {
    const uuid = offlineUuid("Laoda");
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(offlineUuid("laoda")).not.toBe(uuid);
    expect(offlineUuid(" Laoda")).not.toBe(uuid);
  });
});

describe("parseGameDir", () => {
  test("pulls the game dir out of a real PCL java command line", () => {
    const line =
      'java.exe --username eason --version 1.20.6 --gameDir "E:\\PCL Launcher\\.minecraft\\versions\\1.20.6" --assetsDir x';
    expect(parseGameDir(line)).toBe("E:\\PCL Launcher\\.minecraft\\versions\\1.20.6");
  });

  test("handles an unquoted path and returns null when absent", () => {
    expect(parseGameDir("java --gameDir /tmp/mc --foo")).toBe("/tmp/mc");
    expect(parseGameDir("java --foo bar")).toBeNull();
  });
});

describe("isWorldLoaded — 现在能不能安全写", () => {
  /** 造一个"有 session.lock 的存档目录"（探测靠这个文件，所以必须真存在）。 */
  function fakeWorld(lock = true): string {
    const dir = mkdtempSync(join(tmpdir(), "itto-world-"));
    if (lock) writeFileSync(join(dir, "session.lock"), "0");
    return dir;
  }

  test("world in use -> don't touch it", () => {
    expect(isWorldLoaded(fakeWorld(), () => "LOCKED")).toBe(true);
  });

  test("at the title screen -> safe to write", () => {
    expect(isWorldLoaded(fakeWorld(), () => "FREE")).toBe(false);
  });

  test("a world that was never opened has no lock -> safe", () => {
    expect(isWorldLoaded(fakeWorld(false), () => "LOCKED")).toBe(false);
  });

  test("if the probe itself fails we pretend it's in use (fail closed)", () => {
    const boom = () => {
      throw new Error("no powershell here");
    };
    expect(isWorldLoaded(fakeWorld(), boom)).toBe(true);
    expect(isWorldLoaded(fakeWorld(), () => "乱码输出")).toBe(true);
  });
});

describe("ops.json merging", () => {
  test("creates the file from nothing", () => {
    expect(JSON.parse(mergeOpsFile(null, opsEntry("Laoda", offlineUuid("Laoda"))))).toEqual([
      { uuid: offlineUuid("Laoda"), name: "Laoda", level: 4, bypassesPlayerLimit: false },
    ]);
  });

  test("keeps other operators and never duplicates us", () => {
    const existing = JSON.stringify([{ uuid: "aaa", name: "eason", level: 4, bypassesPlayerLimit: false }]);
    const merged = JSON.parse(mergeOpsFile(existing, opsEntry("Laoda", offlineUuid("Laoda"))));
    expect(merged.length).toBe(2);
    expect(merged[0].name).toBe("eason");

    const again = JSON.parse(mergeOpsFile(JSON.stringify(merged), opsEntry("Laoda", offlineUuid("Laoda"))));
    expect(again.length).toBe(2);
  });

  test("survives a corrupt / empty file instead of nuking it silently", () => {
    expect(JSON.parse(mergeOpsFile("", opsEntry("Laoda", offlineUuid("Laoda")))).length).toBe(1);
    expect(JSON.parse(mergeOpsFile("not json", opsEntry("Laoda", offlineUuid("Laoda")))).length).toBe(1);
  });
});
