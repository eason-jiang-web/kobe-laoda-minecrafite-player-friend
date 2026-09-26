import { describe, expect, test } from "bun:test";
import {
  findNote,
  formatNote,
  notesDigest,
  notesIndex,
  parseNotes,
  type WikiNotes,
} from "./wiki-notes.js";

const sample: WikiNotes = {
  version: 1,
  studiedAt: "2026-09-26T09:15:33.510Z",
  notes: [
    {
      topic: "僵尸",
      title: "僵尸",
      url: "https://zh.minecraft.wiki/w/僵尸",
      bullets: ["天空光照≤7且方块光照0才刷", "沙漠露天80%变尸壳"],
      extract: "僵尸是一种常见的亡灵敌对生物。",
      studiedAt: "2026-09-26T09:13:55.064Z",
    },
    {
      topic: "刷怪塔",
      title: "Tutorial:刷怪塔",
      url: "https://zh.minecraft.wiki/w/Tutorial:刷怪塔",
      bullets: ["挂机点离可生成方块至少128格"],
      extract: "生物农场是一种设施集群。",
      studiedAt: "2026-09-26T09:14:20.000Z",
    },
  ],
};

describe("parseNotes", () => {
  test("正常文件读得出来", () => {
    const notes = parseNotes(JSON.stringify(sample));
    expect(notes?.notes.length).toBe(2);
    expect(notes?.notes[0]?.topic).toBe("僵尸");
  });

  test("空/坏数据返回 null（不能把大脑搞挂）", () => {
    expect(parseNotes(null)).toBeNull();
    expect(parseNotes("")).toBeNull();
    expect(parseNotes("{ 这不是 json")).toBeNull();
    expect(parseNotes('{"notes":[]}')).toBeNull();
  });

  test("缺字段的条目被丢掉，其余保留", () => {
    const messy = JSON.stringify({
      notes: [
        { topic: "好的", title: "好的", bullets: ["要点"] },
        { topic: "没要点", title: "x", bullets: [] },
        null,
      ],
    });
    const notes = parseNotes(messy);
    expect(notes?.notes.length).toBe(1);
    expect(notes?.notes[0]?.topic).toBe("好的");
  });
});

describe("notesDigest — 常驻提示词的那段", () => {
  test("带日期、条目数、主题和要点", () => {
    const text = notesDigest(sample);
    expect(text).toContain("2026-09-26");
    expect(text).toContain("2 个条目");
    expect(text).toContain("### 僵尸");
    expect(text).toContain("天空光照≤7");
  });

  test("没笔记时给空串（别往提示词里塞废话）", () => {
    expect(notesDigest(null)).toBe("");
    expect(notesDigest({ version: 1, studiedAt: "", notes: [] })).toBe("");
  });

  test("超过字数预算就截断，并提示用工具翻剩下的", () => {
    const text = notesDigest(sample, 60);
    expect(text).toContain("wiki_notes");
    expect(text.length).toBeLessThan(400);
  });
});

describe("findNote / notesIndex / formatNote", () => {
  test("按主题、标题、部分匹配都能找到", () => {
    expect(findNote(sample, "僵尸")?.title).toBe("僵尸");
    expect(findNote(sample, "Tutorial:刷怪塔")?.topic).toBe("刷怪塔");
    expect(findNote(sample, "刷怪")?.topic).toBe("刷怪塔");
    expect(findNote(sample, "不存在")).toBeNull();
  });

  test("目录列得出来", () => {
    expect(notesIndex(sample)).toBe("僵尸、刷怪塔");
    expect(notesIndex(null)).toContain("还没有");
  });

  test("单条笔记给出要点 + 原文 + 来源", () => {
    const text = formatNote(sample.notes[0]!);
    expect(text).toContain("天空光照≤7");
    expect(text).toContain("僵尸是一种常见的亡灵敌对生物。");
    expect(text).toContain("zh.minecraft.wiki");
  });
});
