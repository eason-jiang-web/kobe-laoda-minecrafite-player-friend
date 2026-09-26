import { describe, expect, test } from "bun:test";
import {
  clearWikiCache,
  clipExtract,
  formatWikiAnswer,
  looksRelated,
  lookupWiki,
  MAX_EXTRACT_CHARS,
} from "./wiki.js";

/** 造一个够用的假 fetch：按 URL 片段给不同回应，并记下被请求过哪些地址。 */
function fakeFetch(routes: Array<{ match: string; body: unknown }>) {
  const seen: string[] = [];
  const impl = (async (url: string | URL) => {
    const u = String(url);
    seen.push(u);
    const route = routes.find((r) => u.includes(r.match));
    if (!route) {
      return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => route.body } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, seen };
}

describe("clipExtract", () => {
  test("短的照原样给", () => {
    expect(clipExtract("铁是一种金属材料。")).toBe("铁是一种金属材料。");
  });

  test("太长就截断，并且说明后面还有", () => {
    const long = "字".repeat(MAX_EXTRACT_CHARS + 500);
    const out = clipExtract(long);
    expect(out.length).toBeLessThan(long.length);
    expect(out).toContain("后面还有");
  });

  test("顺手清掉 CR 和多余空行（wiki 正文常带这些）", () => {
    expect(clipExtract("a\r\n\n\n\nb")).toBe("a\n\nb");
  });
});

describe("formatWikiAnswer", () => {
  test("查到：给标题、正文、来源链接", () => {
    const text = formatWikiAnswer("铁", {
      title: "铁",
      extract: "铁（Iron）是一种金属材料。",
      url: "https://zh.minecraft.wiki/w/铁",
      lang: "zh",
    });
    expect(text).toContain("铁（Iron）是一种金属材料。");
    expect(text).toContain("https://zh.minecraft.wiki/w/铁");
    expect(text).toContain("Minecraft Wiki");
  });

  test("查不到：老实说查不到，并明确禁止编", () => {
    const text = formatWikiAnswer("不存在的东西", null);
    expect(text).toContain("没有找到");
    expect(text).toContain("记忆");
    expect(text).toContain("不是刚查的");
  });
});

describe("looksRelated — 挡住「搜到不相干页面」这种假知识", () => {
  test("中文：沾边的算相关", () => {
    expect(looksRelated("刷怪塔", "Tutorial:刷怪塔")).toBe(true);
    expect(looksRelated("铁傀儡农场", "铁傀儡")).toBe(true);
    expect(looksRelated("僵尸", "僵尸")).toBe(true);
  });

  test("中文：八竿子打不着的必须挡掉（实测踩过：挖矿技术 -> 基岩版1.20.40）", () => {
    expect(looksRelated("挖矿技术", "基岩版1.20.40")).toBe(false);
    expect(looksRelated("僵尸", "村民")).toBe(false);
  });

  test("英文按词比", () => {
    expect(looksRelated("iron golem farm", "Iron Golem")).toBe(true);
    expect(looksRelated("mob farm", "Potato")).toBe(false);
  });
});

describe("lookupWiki", () => {
  test("标题直接命中：一次请求搞定", async () => {
    clearWikiCache();
    const { impl, seen } = fakeFetch([
      {
        match: "titles=",
        body: { query: { pages: { "1": { title: "铁", extract: "铁是一种金属材料。" } } } },
      },
    ]);
    const page = await lookupWiki("铁", "zh", { fetchImpl: impl });
    expect(page?.title).toBe("铁");
    expect(page?.url).toBe("https://zh.minecraft.wiki/w/%E9%93%81");
    expect(seen.length).toBe(1);
    expect(seen[0]).toContain("explaintext=1"); // 要的是纯文本，不是 wikitext
  });

  test("标题没命中就走搜索（先标题搜索，再全文兜底），命中就取正文", async () => {
    clearWikiCache();
    const { impl, seen } = fakeFetch([
      // 标题搜索命中一个"沾边"的页面
      { match: "srwhat=title", body: { query: { search: [{ title: "Tutorial:刷怪塔" }] } } },
      {
        match: "titles=Tutorial%3A%E5%88%B7%E6%80%AA%E5%A1%94",
        body: { query: { pages: { "9": { title: "Tutorial:刷怪塔", extract: "靠水流把怪冲到中间摔死。" } } } },
      },
      { match: "titles=", body: { query: { pages: { "1": { title: "刷怪", missing: "" } } } } },
    ]);
    const page = await lookupWiki("刷怪塔", "zh", { fetchImpl: impl });
    expect(page?.title).toBe("Tutorial:刷怪塔");
    expect(page?.extract).toContain("水流");
    expect(seen.some((u) => u.includes("srwhat=title"))).toBe(true);
  });

  test("搜到不相干的宁可查不到（别学假知识）", async () => {
    clearWikiCache();
    const { impl } = fakeFetch([
      // 标题和全文搜索都给一个完全不沾边的页面（实测：挖矿技术 → 基岩版1.20.40）
      { match: "list=search", body: { query: { search: [{ title: "基岩版1.20.40" }] } } },
      { match: "titles=", body: { query: { pages: { "1": { title: "挖矿技术", missing: "" } } } } },
    ]);
    expect(await lookupWiki("挖矿技术", "zh", { fetchImpl: impl })).toBeNull();
  });

  test("同一个词第二次问不再请求（有缓存）", async () => {
    clearWikiCache();
    const { impl, seen } = fakeFetch([
      { match: "titles=", body: { query: { pages: { "1": { title: "钻石", extract: "钻石很硬。" } } } } },
    ]);
    await lookupWiki("钻石", "zh", { fetchImpl: impl });
    await lookupWiki("钻石", "zh", { fetchImpl: impl });
    expect(seen.length).toBe(1);
  });

  test("网络炸了也不抛错，返回 null", async () => {
    clearWikiCache();
    const boom = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    expect(await lookupWiki("铁", "zh", { fetchImpl: boom })).toBeNull();
  });

  test("英文 wiki 用英文域名", async () => {
    clearWikiCache();
    const { impl, seen } = fakeFetch([
      { match: "titles=", body: { query: { pages: { "1": { title: "Iron", extract: "Iron is a metal." } } } } },
    ]);
    const page = await lookupWiki("Iron", "en", { fetchImpl: impl });
    expect(seen[0]).toContain("minecraft.wiki");
    expect(page?.url).toContain("minecraft.wiki/w/Iron");
  });
});
