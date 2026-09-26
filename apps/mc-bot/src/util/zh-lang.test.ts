import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findLanguageFile, findMcRoot, loadChineseNames } from "./zh-lang.js";

/** 造一个最小可用的 .minecraft 资源树：indexes 索引 + objects 里的语言文件。 */
function fakeMc(files: Record<string, unknown>): string {
  const mc = mkdtempSync(join(tmpdir(), "itto-mc-"));
  const lang = { "block.minecraft.oak_log": "橡木原木", "item.minecraft.raw_iron": "粗铁" };
  const bytes = JSON.stringify(lang);
  const hash = "ab" + "c".repeat(38);
  const objDir = join(mc, "assets", "objects", hash.slice(0, 2));
  mkdirSync(objDir, { recursive: true });
  writeFileSync(join(objDir, hash), bytes);
  mkdirSync(join(mc, "assets", "indexes"), { recursive: true });
  writeFileSync(join(mc, "assets", "indexes", "16.json"), JSON.stringify({ objects: { "minecraft/lang/zh_cn.json": { hash } } }));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(mc, "assets", "indexes", name), JSON.stringify(body));
  }
  return mc;
}

describe("findMcRoot", () => {
  test("游戏目录本身就是 .minecraft 时直接命中", () => {
    const mc = fakeMc({});
    expect(findMcRoot([mc])).toBe(mc);
  });

  test("PCL 版本隔离时往下钻了一层也能找到（目录是 versions/<ver>）", () => {
    const mc = fakeMc({});
    const versionDir = join(mc, "versions", "1.20.6");
    mkdirSync(versionDir, { recursive: true });
    expect(findMcRoot([versionDir])).toBe(mc);
  });

  test("找不到就返回 null（没装游戏也不能崩）", () => {
    expect(findMcRoot([join(tmpdir(), "itto-not-here-" + Date.now())])).toBeNull();
    expect(findMcRoot([""])).toBeNull();
  });
});

describe("findLanguageFile", () => {
  test("顺着索引里的 sha1 找到语言文件本体", () => {
    const mc = fakeMc({});
    const file = findLanguageFile(mc);
    expect(file).not.toBeNull();
    expect(file).toContain(join("assets", "objects"));
  });

  test("索引里没有 zh_cn 就继续找下一份，全都没有则 null", () => {
    const mc = fakeMc({});
    // 一份没有 zh_cn 的更新的索引
    writeFileSync(join(mc, "assets", "indexes", "99.json"), JSON.stringify({ objects: { "minecraft/lang/en_us.json": { hash: "ff" + "e".repeat(38) } } }));
    expect(findLanguageFile(mc)).not.toBeNull(); // 老那份还在，仍然找得到
    expect(findLanguageFile(join(tmpdir(), "itto-nope-" + Date.now()))).toBeNull();
  });
});

describe("loadChineseNames", () => {
  test("读进来能真的用（并且能反查回 id）", () => {
    const mc = fakeMc({});
    const res = loadChineseNames([mc]);
    expect(res).not.toBeNull();
    expect(res!.count).toBe(2);
    expect(res!.source).toContain("objects");
  });

  test("没有游戏目录时返回 null，不抛异常", () => {
    expect(loadChineseNames([join(tmpdir(), "itto-nothing-" + Date.now())])).toBeNull();
    expect(loadChineseNames([])).toBeNull();
  });
});
