import { describe, expect, test } from "bun:test";
import { normalizeSchema } from "./schema.js";
import { formatHistory, type HistoryEntry } from "./history.js";

describe("normalizeSchema", () => {
  test("strips $schema and forces an object root", () => {
    const out = normalizeSchema({ $schema: "http://json-schema.org/draft-07/schema#", type: "object", properties: {} });
    expect(out.$schema).toBeUndefined();
    expect(out.type).toBe("object");
  });

  test("garbage in, usable object schema out", () => {
    expect(normalizeSchema(undefined)).toEqual({ type: "object", properties: {} });
    expect(normalizeSchema("nope")).toEqual({ type: "object", properties: {} });
  });

  test("inlines $ref against definitions", () => {
    const out = normalizeSchema({
      type: "object",
      properties: { target: { $ref: "#/definitions/Vec3" } },
      definitions: { Vec3: { type: "object", properties: { x: { type: "number" } }, required: ["x"] } },
    });
    expect(out.definitions).toBeUndefined();
    const props = out.properties as Record<string, Record<string, unknown>>;
    expect(props.target?.type).toBe("object");
    expect((props.target?.properties as Record<string, unknown>).x).toEqual({ type: "number" });
  });

  test("drops null out of union types", () => {
    const out = normalizeSchema({ type: "object", properties: { n: { type: ["string", "null"] } } });
    const props = out.properties as Record<string, Record<string, unknown>>;
    expect(props.n?.type).toBe("string");
  });

  test("keeps real unions as anyOf", () => {
    const out = normalizeSchema({ type: "object", properties: { n: { type: ["string", "number"] } } });
    const props = out.properties as Record<string, Record<string, unknown>>;
    expect(props.n?.type).toBeUndefined();
    expect(props.n?.anyOf).toEqual([{ type: "string" }, { type: "number" }]);
  });
});

describe("formatHistory", () => {
  test("renders recent turns compactly", () => {
    const entries: HistoryEntry[] = [
      { at: 1_000, reason: 'eason said "itto"', said: "yo", did: ["chat"] },
      { at: 2_000, reason: "heartbeat", said: "", did: [] },
    ];
    const out = formatHistory(entries, 61_000);
    expect(out).toContain('eason said "itto"');
    expect(out).toContain('said "yo" [chat]');
    expect(out).toContain("stayed quiet");
  });
});
