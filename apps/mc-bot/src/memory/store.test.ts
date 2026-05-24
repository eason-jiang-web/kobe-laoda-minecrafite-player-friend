import { test, expect } from "bun:test";
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
