#!/usr/bin/env bun
/**
 * 自修：让牢大把 Minecraft Wiki 读一遍，写成自己的笔记。
 *
 *   bun run study:wiki              # 没学过的条目才学（可以反复跑，只补新的）
 *   bun run study:wiki --force      # 全部重学
 *   bun run study:wiki --topic 僵尸 # 只学一条
 *
 * 每一轮做两件事：
 *   ① 去中文 Minecraft Wiki 取条目摘要（复用 mcp-server 里的同一个 wiki 模块）
 *   ② 把这 1500 字交给 DeepSeek，让它自己蒸馏成"能改变行动"的要点（数值/条件/顺序）
 *
 * 产物是本地文件（data/wiki/notes.json + notes.md）：
 *   - 大脑启动时读它，要点常驻提示词最前面（稳定前缀，吃到缓存）
 *   - 不确定时用 wiki_notes 工具翻原文 —— 不用联网
 *   - notes.md 是给**人**看的：你能直接读它到底学了什么
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { lookupWiki } from "@itto/mcp-server";
import type { WikiNote, WikiNotes } from "@itto/shared";
import { DeepSeekClient } from "../src/deepseek.js";

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const ONE = argv.includes("--topic") ? (argv[argv.indexOf("--topic") + 1] ?? "") : "";

const OUT_DIR = process.env.ITTO_WIKI_DIR ?? "data/wiki";
const NOTES_JSON = join(OUT_DIR, "notes.json");
const NOTES_MD = join(OUT_DIR, "notes.md");

/**
 * 学什么：不是"把 wiki 抄一遍"，而是**它会用到的那些**。
 * 顺序按"这个阶段最需要"排，这样中途停掉也是先有用的先学到。
 */
const TOPICS: string[] = [
  // 生存基础
  "饥饿", "食物", "工具", "合成", "熔炉", "床", "火把", "光照",
  // 挖矿
  "矿石", "煤炭", "铁", "钻石", "黑曜石", "远古残骸", "下界合金", "采矿", "洞穴",
  // 怪物与会打架
  "僵尸", "骷髅", "苦力怕", "蜘蛛", "末影人", "女巫", "溺尸", "骷髅马", "幻翼",
  "战斗", "盾牌", "附魔", "药水",
  // 设施与农业
  "刷怪塔", "小麦", "甘蔗", "胡萝卜", "南瓜", "动物繁殖", "村民", "村民交易", "铁傀儡", "经验",
  // 主线
  "下界传送门", "下界要塞", "烈焰人", "末影珍珠", "末影之眼", "要塞", "末影龙", "末地城", "鞘翅",
  // 杂项常用
  "水桶", "船", "矿车", "地图", "村庄", "沙漠神殿", "沉船", "废弃矿井",
];

/** 蒸馏用的提示词：只要"会改变行动"的事实。 */
function distillPrompt(topic: string, title: string, extract: string): string {
  return [
    "你在帮一个 Minecraft 机器人整理知识笔记。下面是我从中文 Minecraft Wiki 抓的《" + title + "》条目摘要。",
    "请把它压成**能改变行动**的要点 —— 判断标准是：知道这条之后，机器人做的事会不一样。",
    "",
    "要求：",
    "- 3~6 条，每条 ≤ 40 字，直接说事实，不要「需要注意的是」这种废话",
    "- 优先保留：数值（光照/高度/数量）、条件（什么时候会/不会发生）、顺序（先做什么）",
    "- 用中文，不要 markdown 标记，不要重复标题里的词",
    '- 只输出 JSON 数组，形如 ["要点1","要点2"]，不要任何解释',
    "",
    "【" + title + "】摘要：",
    extract.slice(0, 1600),
  ].join("\n");
}

function parseBullets(content: string | null): string[] {
  if (!content) return [];
  const match = /\[[\s\S]*\]/.exec(content);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
  } catch {
    return [];
  }
}

function loadExisting(): WikiNotes {
  // 注意：--force 只表示"这几条重学"，**不清空**其它笔记
  // （原来的写法会把整个文件清掉，只剩这一次学的条目）。
  if (!existsSync(NOTES_JSON)) {
    return { version: 1, studiedAt: new Date().toISOString(), notes: [] };
  }
  try {
    const parsed = JSON.parse(readFileSync(NOTES_JSON, "utf8")) as WikiNotes;
    if (!Array.isArray(parsed.notes)) throw new Error("bad shape");
    return parsed;
  } catch {
    console.log("  （旧笔记读不出来，重新开始）");
    return { version: 1, studiedAt: new Date().toISOString(), notes: [] };
  }
}

function writeNotes(notes: WikiNotes): void {
  mkdirSync(OUT_DIR, { recursive: true });
  notes.studiedAt = new Date().toISOString();
  writeFileSync(NOTES_JSON, JSON.stringify(notes, null, 2) + "\n", "utf8");

  const md = [
    "# 牢大自修的 Minecraft 笔记",
    "",
    "> 由 `bun run study:wiki` 生成：读中文 Minecraft Wiki → DeepSeek 自己蒸馏成要点。",
    "> 大脑启动时会读 notes.json（要点常驻提示词，原文按需用 wiki_notes 工具翻）。",
    "> 学于 " + notes.studiedAt + "，共 " + notes.notes.length + " 个条目。",
    "",
  ];
  for (const n of notes.notes) {
    md.push("## " + n.topic + "（" + n.title + "）");
    for (const b of n.bullets) md.push("- " + b);
    md.push("");
    md.push("<details><summary>wiki 原文摘要</summary>");
    md.push("");
    md.push(n.extract);
    md.push("");
    md.push("来源：" + n.url);
    md.push("</details>");
    md.push("");
  }
  writeFileSync(NOTES_MD, md.join("\n"), "utf8");
}

async function main(): Promise<void> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("没有 DEEPSEEK_API_KEY（.env 里配一个）");
  const ds = new DeepSeekClient({ apiKey: key, maxTokens: 400, temperature: 0.2 });

  const notes = loadExisting();
  const done = new Set(notes.notes.map((n) => n.topic));
  const todo = (ONE ? [ONE] : TOPICS).filter((t) => FORCE || !done.has(t));

  console.log("");
  console.log("  ── 自修 Minecraft Wiki ──────────────────────────────");
  console.log("  已有笔记 " + notes.notes.length + " 条，这次要学 " + todo.length + " 条");
  console.log("");

  let learned = 0;
  let failed = 0;
  for (const topic of todo) {
    const t0 = Date.now();
    process.stdout.write("  [" + (learned + failed + 1) + "/" + todo.length + "] " + topic + " … ");
    try {
      const page = await lookupWiki(topic, "zh");
      if (!page) {
        console.log("wiki 上没查到，跳过");
        failed++;
        continue;
      }
      const reply = await ds.complete(
        [
          { role: "system", content: "你是一个把 wiki 摘要压成行动要点的助手。只输出 JSON 数组。" },
          { role: "user", content: distillPrompt(topic, page.title, page.extract) },
        ],
        // 只要文字，不要它调工具
        [],
      );
      const bullets = parseBullets(reply.content);
      if (bullets.length === 0) {
        console.log("蒸馏失败（模型没给要点），跳过");
        failed++;
        continue;
      }
      const note: WikiNote = {
        topic,
        title: page.title,
        url: page.url,
        bullets,
        extract: page.extract.slice(0, 2000),
        studiedAt: new Date().toISOString(),
      };
      notes.notes = notes.notes.filter((n) => n.topic !== topic).concat(note);
      // 每学一条就落盘：中途 Ctrl+C 也不会白学
      writeNotes(notes);
      learned++;
      console.log("《" + page.title + "》 " + bullets.length + " 条要点（" + (Date.now() - t0) + "ms）");
    } catch (e) {
      failed++;
      console.log("出错：" + (e as Error).message.slice(0, 90));
    }
  }

  writeNotes(notes);
  console.log("");
  console.log("  ✓ 这次学了 " + learned + " 条，跳过/失败 " + failed + " 条，累计 " + notes.notes.length + " 条");
  console.log("    笔记：" + NOTES_JSON);
  console.log("    给人看的版本：" + NOTES_MD);
  console.log("");
}

main().catch((e: unknown) => {
  console.error("自修失败：" + (e as Error).message);
  process.exit(1);
});
