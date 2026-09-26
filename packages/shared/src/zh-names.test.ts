import { describe, expect, test } from "bun:test";
import {
  chineseNameCount,
  entityNameZh,
  hasChineseNames,
  itemIdFromZh,
  itemNameZh,
  setChineseNames,
  toItemId,
} from "./zh-names.js";

describe("itemNameZh — 兜底词典（还没读语言文件时）", () => {
  test("常见东西本来就是中文", () => {
    expect(itemNameZh("oak_log")).toBe("橡木原木");
    expect(itemNameZh("raw_iron")).toBe("粗铁");
    expect(itemNameZh("netherite_ingot")).toBe("下界合金锭");
    expect(itemNameZh("diamond")).toBe("钻石");
  });

  test("带命名空间的也认", () => {
    expect(itemNameZh("minecraft:oak_log")).toBe("橡木原木");
  });
});

describe("构词法 — 词典里没有的也要像中文", () => {
  test("木材 + 形状", () => {
    expect(itemNameZh("birch_stairs")).toBe("白桦楼梯");
    expect(itemNameZh("dark_oak_fence_gate")).toBe("深色橡木栅栏门");
    expect(itemNameZh("spruce_planks")).toBe("云杉木板");
  });

  test("深层矿 / 处理方式", () => {
    expect(itemNameZh("deepslate_diamond_ore")).toBe("深层钻石矿石");
    expect(itemNameZh("stripped_oak_log")).toBe("去皮橡木原木");
    expect(itemNameZh("raw_copper_block")).toBe("粗制铜块");
  });

  test("实在认不得就原样返回 id（不编、不空白）", () => {
    expect(itemNameZh("totally_unknown_thing")).toBe("totally_unknown_thing");
  });
});

describe("语言文件灌进来之后", () => {
  test("官方译名逐字一致，而且物品压过方块/生物", () => {
    const n = setChineseNames({
      "entity.minecraft.chicken": "鸡",
      "item.minecraft.chicken": "生鸡肉",
      "block.minecraft.oak_log": "橡木原木",
      "item.minecraft.iron_ingot": "铁锭",
    });
    expect(n).toBe(4);
    expect(hasChineseNames()).toBe(true);
    expect(chineseNameCount()).toBe(4);
    expect(itemNameZh("chicken")).toBe("生鸡肉");
    expect(entityNameZh("chicken")).toBe("鸡");
    expect(itemNameZh("iron_ingot")).toBe("铁锭");
  });

  test("坏数据不会污染表", () => {
    setChineseNames({ "item.minecraft.good": "好东西", "item.minecraft.bad": "", "Not.A.Key": "x" });
    expect(itemNameZh("good")).toBe("好东西");
    expect(itemNameZh("Not.A.Key")).toBe("Not.A.Key"); // 不是合法 id，没被收进去
  });
});

describe("itemIdFromZh — 模型说中文，工具要 id", () => {
  test("从中文名反查回 id", () => {
    expect(itemIdFromZh("橡木原木")).toBe("oak_log");
    expect(itemIdFromZh("铁锭")).toBe("iron_ingot");
  });

  test("口语简称也认", () => {
    expect(itemIdFromZh("铁")).toBe("iron_ingot");
    expect(itemIdFromZh("木头")).toBe("oak_log");
    expect(itemIdFromZh("下界合金")).toBe("netherite_ingot");
  });

  test("本来就是 id 的原样返回（幂等）", () => {
    expect(itemIdFromZh("oak_log")).toBe("oak_log");
    expect(toItemId("oak_log")).toBe("oak_log");
    expect(toItemId("minecraft:stone")).toBe("stone");
  });

  test("认不出来返回 null，交给调用方报错", () => {
    expect(itemIdFromZh("世上没有这个东西")).toBeNull();
    expect(toItemId("世上没有这个东西")).toBe("世上没有这个东西");
    expect(itemIdFromZh("   ")).toBeNull();
  });
});
