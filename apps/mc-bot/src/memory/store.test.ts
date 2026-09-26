import { test, expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HABIT, recordAsk } from "@itto/shared";
import { WorldMemory } from "./store.js";

const fresh = () => new WorldMemory(":memory:");

test("remember + recall a waypoint (upsert by name)", () => {
  const m = fresh();
  m.rememberLocation({ name: "home", pos: { x: 1, y: 2, z: 3 }, dimension: "overworld", kind: "base" });
  m.rememberLocation({ name: "home", pos: { x: 10, y: 20, z: 30 }, dimension: "overworld", kind: "base" });
  const wps = m.recallLocations();
  expect(wps.length).toBe(1); // upsert, not duplicate
  expect(wps[0]!.pos).toEqual({ x: 10, y: 20, z: 30 });
  m.close();
});

test("recall filters by kind and sorts by distance", () => {
  const m = fresh();
  m.rememberLocation({ name: "near", pos: { x: 0, y: 0, z: 5 }, dimension: "overworld", kind: "poi" });
  m.rememberLocation({ name: "far", pos: { x: 0, y: 0, z: 100 }, dimension: "overworld", kind: "poi" });
  m.rememberLocation({ name: "base", pos: { x: 0, y: 0, z: 1 }, dimension: "overworld", kind: "base" });
  const pois = m.recallLocations({ kind: "poi", near: { x: 0, y: 0, z: 0 } });
  expect(pois.map((w) => w.name)).toEqual(["near", "far"]);
  m.close();
});

test("indexChest + findChestsWithItem ranks by count", () => {
  const m = fresh();
  m.indexChest({
    pos: { x: 0, y: 64, z: 0 },
    dimension: "overworld",
    contents: [{ item: "iron_ingot", count: 5 }],
  });
  m.indexChest({
    pos: { x: 10, y: 64, z: 0 },
    dimension: "overworld",
    contents: [{ item: "iron_ingot", count: 20 }, { item: "coal", count: 3 }],
  });
  const hits = m.findChestsWithItem("iron_ingot", "overworld");
  expect(hits.length).toBe(2);
  expect(hits[0]!.count).toBe(20); // most-stocked first
  expect(hits[0]!.chest.pos.x).toBe(10);
  m.close();
});

test("re-indexing a chest replaces its contents", () => {
  const m = fresh();
  const pos = { x: 0, y: 64, z: 0 };
  m.indexChest({ pos, dimension: "overworld", contents: [{ item: "iron_ingot", count: 5 }] });
  m.indexChest({ pos, dimension: "overworld", contents: [{ item: "gold_ingot", count: 2 }] });
  expect(m.findChestsWithItem("iron_ingot").length).toBe(0);
  expect(m.findChestsWithItem("gold_ingot").length).toBe(1);
  m.close();
});

test("forgetLocation removes a waypoint", () => {
  const m = fresh();
  m.rememberLocation({ name: "temp", pos: { x: 0, y: 0, z: 0 }, dimension: "overworld" });
  expect(m.forgetLocation("temp")).toBe(true);
  expect(m.forgetLocation("temp")).toBe(false);
  expect(m.recallLocations().length).toBe(0);
  m.close();
});

test("snapshot returns waypoints + chests with contents", () => {
  const m = fresh();
  m.rememberLocation({ name: "home", pos: { x: 0, y: 0, z: 0 }, dimension: "overworld", kind: "base" });
  m.indexChest({ pos: { x: 1, y: 1, z: 1 }, dimension: "overworld", contents: [{ item: "coal", count: 4 }] });
  const snap = m.snapshot();
  expect(snap.waypoints.length).toBe(1);
  expect(snap.chests.length).toBe(1);
  expect(snap.chests[0]!.contents).toEqual([{ item: "coal", count: 4 }]);
  m.close();
});

// ── 追问预算 / 习惯 / 熟练度（重启之后还得记得住，所以必须落盘）────────────

test("追问次数存得住，问满之后有「别再问」的提示", () => {
  const m = fresh();
  const now = Date.now();
  let recs = m.askRecords();
  expect(recs.length).toBe(0);
  expect(m.askHintLine(now)).toBeNull();

  for (let i = 1; i <= 3; i++) {
    recs = recordAsk(recs, "去哪个地方", "去哪个地方", now + i);
    m.saveAskRecords(recs);
    expect(m.askRecords()[0]!.count).toBe(i);
  }
  const hint = m.askHintLine(now + 10);
  expect(hint).not.toBeNull();
  expect(hint).toContain("去哪个地方");
  m.close();
});

test("习惯是累加的，不是覆盖", () => {
  const m = fresh();
  m.bumpHabit(HABIT.command("#back"));
  m.bumpHabit(HABIT.command("#back"));
  m.bumpHabit(HABIT.chat);
  m.bumpHabit(HABIT.chatChars, 12);
  const p = m.profile();
  const back = p.habits.find((h) => h.key === HABIT.command("#back"));
  expect(back?.n).toBe(2);
  expect(p.habits.find((h) => h.key === HABIT.chatChars)?.n).toBe(12);
  m.close();
});

test("熟练度按成败累加", () => {
  const m = fresh();
  m.noteOutcome("mining", true);
  m.noteOutcome("mining", true);
  m.noteOutcome("mining", false);
  const line = m.profile().adaptation.find((a) => a.area === "mining");
  expect(line?.attempts).toBe(3);
  expect(line?.successes).toBe(2);
  m.close();
});

test("同一句教训不会重复记（重复记等于没记）", () => {
  const m = fresh();
  m.addLesson("lesson", "晚上别在平原乱走");
  m.addLesson("lesson", "晚上别在平原乱走");
  m.addLesson("lesson", "   ");
  expect(m.profile().lessons.length).toBe(1);
  m.close();
});

test("画像摘要会写到文件（大脑是另一个进程，只能读文件）", () => {
  const dir = mkdtempSync(join(tmpdir(), "itto-profile-"));
  const path = join(dir, "profile-digest.txt");
  const m = new WorldMemory(":memory:", { digestPath: path });
  m.bumpHabit(HABIT.command("#back"), 12);
  m.bumpHabit(HABIT.chat, 20);
  m.bumpHabit(HABIT.chatChars, 100);
  m.noteOutcome("mining", true);
  m.addLesson("lesson", "晚上别在平原乱走");
  m.addLesson("preference", "喜欢挖矿，不喜欢下矿洞");

  const text = m.writeDigest();
  expect(readFileSync(path, "utf8")).toBe(text);
  expect(text).toContain("#back");
  expect(text).toContain("挖矿");
  expect(text).toContain("晚上别在平原乱走");
  expect(text).toContain("喜欢挖矿");

  rmSync(dir, { recursive: true, force: true });
  m.close();
});

test("#profile 那句话在没数据时说人话、有数据时报数字", () => {
  const m = fresh();
  expect(m.briefText()).toContain("多带我干点活");
  m.noteOutcome("combat", false);
  m.bumpHabit(HABIT.command("#attack"), 3);
  const brief = m.briefText();
  expect(brief).toContain("打架");
  expect(brief).toContain("0/1");
  m.close();
});
