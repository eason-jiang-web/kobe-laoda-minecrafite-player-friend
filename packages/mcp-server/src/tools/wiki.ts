import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";
import {
  findNote,
  formatNote,
  notesIndex,
  parseNotes,
  WikiLookupInput,
  WikiNotesInput,
  type BotControl,
  type WikiNotes,
} from "@itto/shared";
import { ok } from "./_util.js";

/**
 * 查 Minecraft Wiki（minecraft.wiki / zh.minecraft.wiki）来补知识。
 *
 * 为什么需要它：模型的常识够用，但细节会过时或记混 —— 刷怪条件、生成高度、
 * 配方、版本差异这些，wiki 上写着。让它自己去查，比在提示词里堆一大段死知识靠谱
 * （那种迟早对不上版本）。
 *
 * 实现：走 MediaWiki 的 Action API（不用爬 HTML，也不用 key）。
 *   ① 先按标题直接取（大多数查询就是条目标题：「铁」「僵尸」「附魔台」）
 *   ② 没有再全文搜索，取第一条命中
 *   ③ 正文用 TextExtracts 的纯文本，截断到 ~1500 字（够说清机制，又不炸上下文）
 *
 * 拿到什么就说什么：查不到就如实说查不到，**不许编**。
 */

/** 单次返回的正文上限（字）。够讲清机制，又不至于把上下文塞满。 */
export const MAX_EXTRACT_CHARS = 1500;

/** 缓存：同一轮里反复问同一个词不该反复请求（也省得被 wiki 限流）。 */
const cache = new Map<string, { page: WikiPage | null; at: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

/** 只给测试用：清缓存，免得用例之间互相影响。 */
export function clearWikiCache(): void {
  cache.clear();
}

export interface WikiPage {
  title: string;
  extract: string;
  url: string;
  lang: string;
}

export interface WikiDeps {
  /** 可注入：测试里换成假 fetch，别真联网。 */
  fetchImpl?: typeof fetch;
}

/** 太长就截断，并且说清楚截断了（免得模型以为这就是全部）。 */
export function clipExtract(text: string, max = MAX_EXTRACT_CHARS): string {
  const clean = text
    .replace(/\r/g, "")
    // TextExtracts 的纯文本里还留着 wiki 标记：== 生成 == 这种标题、§ 章节引用。
    // 留着模型也看得懂，但读起来像半成品，顺手清成普通句子。
    .replace(/={2,}\s*([^=\n]+?)\s*={2,}/g, "$1")
    .replace(/§\s*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max) + "…（后面还有，需要更细的可以换关键词再查）";
}

/** 把结果写成模型能直接用的一段话。查不到时明确说查不到。 */
export function formatWikiAnswer(query: string, page: WikiPage | null): string {
  if (!page) {
    return (
      "wiki 上没有找到「" + query + "」这个条目（可能是我搜的词不对，或者网络不通）。" +
      "换个说法再试一次；实在查不到就按你已知的说，并且说清这是你的记忆、不是刚查的。"
    );
  }
  return [
    "【Minecraft Wiki · " + page.title + "】（" + page.lang + "）",
    clipExtract(page.extract),
    "来源：" + page.url,
  ].join("\n");
}

/**
 * 搜到的条目标题和查询词"沾不沾边"。
 *
 * 为什么必须有这道闸：wiki 的**全文**搜索对"挖矿技术"这种词会返回
 * 《基岩版1.20.40》之类八竿子打不着的页面 —— 那等于给模型喂假知识，
 * 比"查不到"糟糕得多。中文看两字滑窗是否命中，英文看是否有共同的词。
 */
export function looksRelated(query: string, title: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s:：_\-（）()【】\[\]]/g, "");
  const q = norm(query);
  const t = norm(title);
  if (q.length === 0 || t.length === 0) return false;
  if (t.includes(q) || q.includes(t)) return true;

  // 中文：两字滑窗
  for (let i = 0; i + 2 <= q.length; i++) {
    if (t.includes(q.slice(i, i + 2))) return true;
  }

  // 英文/混合：共同的词（长度 ≥ 3，避开 the/of/and）
  const words = (s: string) => s.split(/[\s_\-]+/).filter((w) => w.length >= 3);
  const tw = new Set(words(title.toLowerCase()));
  return words(query.toLowerCase()).some((w) => tw.has(w));
}

function apiBase(lang: string): string {
  return lang === "en" ? "https://minecraft.wiki/api.php" : "https://zh.minecraft.wiki/api.php";
}

interface QueryResponse {
  query?: {
    pages?: Record<string, { title?: string; extract?: string; missing?: string }>;
    search?: Array<{ title: string }>;
  };
}

async function getJson(url: string, fetchImpl: typeof fetch): Promise<QueryResponse | null> {
  try {
    const res = await fetchImpl(url, {
      // wiki 会拦没有 UA 的脚本请求；带上身份也是礼貌
      headers: { "user-agent": "itto-bot/1.0 (personal Minecraft buddy; local use)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as QueryResponse;
  } catch {
    return null;
  }
}

/** 按标题取正文（页名就是查询词时最快最准）。 */
function extractFromPages(data: QueryResponse | null): { title: string; extract: string } | null {
  const pages = data?.query?.pages;
  if (!pages) return null;
  for (const page of Object.values(pages)) {
    if (page.missing !== undefined) continue;
    const extract = typeof page.extract === "string" ? page.extract.trim() : "";
    if (page.title && extract.length > 0) return { title: page.title, extract };
  }
  return null;
}

/**
 * 查一条。先按标题，再全文搜索；都拿不到返回 null（不抛错）。
 */
export async function lookupWiki(
  query: string,
  lang: string,
  deps: WikiDeps = {},
): Promise<WikiPage | null> {
  const q = query.trim();
  if (q.length === 0) return null;

  const key = lang + ":" + q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.page;

  const fetchImpl = deps.fetchImpl ?? fetch;
  const base = apiBase(lang);
  const common = "&format=json&redirects=1&explaintext=1&prop=extracts";

  // ① 直接按标题
  let page = extractFromPages(
    await getJson(base + "?action=query&titles=" + encodeURIComponent(q) + common, fetchImpl),
  );

  // ② 标题搜索（比全文准得多："僵尸" 只会命中标题里带僵尸的页面）
  if (!page) {
    const byTitle = await getJson(
      base + "?action=query&list=search&srwhat=title&srlimit=3&srsearch=" +
        encodeURIComponent(q) +
        "&format=json",
      fetchImpl,
    );
    for (const hit of byTitle?.query?.search?.slice(0, 3) ?? []) {
      if (!looksRelated(q, hit.title)) continue;
      page = extractFromPages(
        await getJson(base + "?action=query&titles=" + encodeURIComponent(hit.title) + common, fetchImpl),
      );
      if (page) break;
    }
  }

  // ③ 全文兜底 —— 但**必须过相关性闸**。宁可控不到，也不能喂假知识。
  if (!page) {
    const found = await getJson(
      base + "?action=query&list=search&srlimit=3&srsearch=" + encodeURIComponent(q) + "&format=json",
      fetchImpl,
    );
    for (const hit of found?.query?.search?.slice(0, 3) ?? []) {
      if (!looksRelated(q, hit.title)) continue;
      page = extractFromPages(
        await getJson(base + "?action=query&titles=" + encodeURIComponent(hit.title) + common, fetchImpl),
      );
      if (page) break;
    }
  }

  const result: WikiPage | null = page
    ? {
        title: page.title,
        extract: page.extract,
        url: (lang === "en" ? "https://minecraft.wiki/w/" : "https://zh.minecraft.wiki/w/") +
          encodeURIComponent(page.title.replace(/ /g, "_")),
        lang,
      }
    : null;

  cache.set(key, { page: result, at: Date.now() });
  return result;
}

/** 自修笔记的位置（study-wiki.ts 写的那个文件）。 */
function notesPath(): string {
  return process.env.BRAIN_WIKI_NOTES_PATH ?? "data/wiki/notes.json";
}

/** 读笔记文件；读不到返回 null（没学过就当作没有，不影响别的）。 */
function readNotes(): WikiNotes | null {
  try {
    return parseNotes(readFileSync(notesPath(), "utf8"));
  } catch {
    return null;
  }
}

export function registerWikiTools(server: McpServer, _control: BotControl): void {
  server.tool(
    "wiki_notes",
    "Read back your OWN study notes (written by `bun run study:wiki`, which read the Minecraft Wiki once). " +
      "Instant and offline — prefer this over wiki_lookup for things you already studied. " +
      "Call with no argument to see which topics you have.",
    WikiNotesInput.shape,
    async ({ topic }) => {
      const notes = readNotes();
      if (!notes) {
        return ok("我还没学过 wiki（没找到自修笔记）。用 wiki_lookup 现查一条也行。");
      }
      if (!topic || topic.trim().length === 0) {
        return ok(
          "我自修过这些条目（" + notes.notes.length + " 条，学于 " + notes.studiedAt.slice(0, 10) + "）：" +
            notesIndex(notes) +
            "。想看哪条就把主题名传进来。",
        );
      }
      const note = findNote(notes, topic);
      if (!note) {
        return ok(
          "自修笔记里没有「" + topic + "」。我学过的是：" + notesIndex(notes) +
            "。要么换个词，要么用 wiki_lookup 现查。",
        );
      }
      return ok(formatNote(note));
    },
  );
  server.tool(
    "wiki_lookup",
    "Look something up on the Minecraft Wiki (mechanics, spawn conditions, recipes, version differences). " +
      "Use it when you are NOT sure about a detail instead of guessing. Returns a short plain-text summary + source URL. " +
      "免费、只读，可以放心调。",
    WikiLookupInput.shape,
    async ({ query, lang }) => {
      const page = await lookupWiki(query, lang ?? "zh");
      return ok(formatWikiAnswer(query, page));
    },
  );
}
