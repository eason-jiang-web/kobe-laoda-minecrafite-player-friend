import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendLabel,
  appendTurn,
  joinTurnsWithLabels,
  readLabels,
  readTurns,
  type TrainingTurn,
} from "./training-log.js";

function turn(at: number, over: Partial<TrainingTurn> = {}): TrainingTurn {
  return {
    id: "id-" + at,
    at,
    model: "deepseek-chat",
    reason: 'player said: "牢大 过来"',
    state: "me: hp=20",
    tools: [{ name: "chat", args: '{"message":"来了"}', result: "sent" }],
    said: "来了",
    steps: 1,
    ms: 1200,
    ...over,
  };
}

describe("append + read", () => {
  test("writes one JSONL line per turn and reads them back in order", () => {
    const dir = mkdtempSync(join(tmpdir(), "itto-train-"));
    try {
      appendTurn(turn(2000), dir);
      appendTurn(turn(1000), dir);
      const turns = readTurns(dir);
      expect(turns.length).toBe(2);
      expect(turns.map((t) => t.at)).toEqual([1000, 2000]);
      expect(turns[0]?.tools[0]?.name).toBe("chat");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("labels are appended separately", () => {
    const dir = mkdtempSync(join(tmpdir(), "itto-train-"));
    try {
      appendLabel("good", 1500, dir);
      appendLabel("bad", 2500, dir);
      expect(readLabels(dir)).toEqual([
        { at: 1500, label: "good" },
        { at: 2500, label: "bad" },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("missing directory reads as empty instead of throwing", () => {
    expect(readTurns(join(tmpdir(), "itto-does-not-exist-" + Date.now()))).toEqual([]);
    expect(readLabels(join(tmpdir(), "itto-does-not-exist-" + Date.now()))).toEqual([]);
  });
});

describe("joinTurnsWithLabels", () => {
  test("a label lands on the most recent turn before it", () => {
    const turns = [turn(1000), turn(5000), turn(9000)];
    const out = joinTurnsWithLabels(turns, [{ at: 5200, label: "good" }]);
    expect(out[0]?.feedback).toBeUndefined();
    expect(out[1]?.feedback).toBe("good");
    expect(out[2]?.feedback).toBeUndefined();
  });

  test("stale labels don't attach to anything", () => {
    const out = joinTurnsWithLabels([turn(1000)], [{ at: 1000 + 11 * 60_000, label: "bad" }]);
    expect(out[0]?.feedback).toBeUndefined();
  });

  test("later labels overwrite earlier ones for the same turn", () => {
    const out = joinTurnsWithLabels([turn(1000)], [
      { at: 1100, label: "good" },
      { at: 1200, label: "bad" },
    ]);
    expect(out[0]?.feedback).toBe("bad");
  });
});
