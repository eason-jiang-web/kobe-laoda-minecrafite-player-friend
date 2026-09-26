/**
 * 自修笔记：牢大读了一遍 Minecraft Wiki 之后沉淀下来的东西。
 *
 * 为什么要有这一层（而不是每次现查 wiki）：
 *   ① 现查要 400ms + 网络，还有断网的时候；笔记是本地文件，**瞬时、离线可用**
 *   ② 现查回来是 1500 字原文，每轮都塞进提示词太贵；笔记是它自己压过的要点
 *   ③ 这份要点放在提示词**最前面**（稳定前缀），吃到上下文缓存后几乎不花钱
 *
 * 内容由 `apps/brain-deepseek/scripts/study-wiki.ts` 生成（真读 wiki + 自己蒸馏）。
 * 这里的函数都是纯的：解析、格式化、查找 —— 读文件由调用方做。
 */

export interface WikiNote {
  /** 查的时候用的词（也是以后检索的 key）。 */
  topic: string;
  /** wiki 上的条目标题。 */
  title: string;
  url: string;
  /** 蒸馏出来的要点：每条形如"生成需要光照 ≤7"。 */
  bullets: string[];
  /** 原始摘要（截断过），想看细节时用。 */
  extract: string;
  /** 什么时候学的（ISO）。 */
  studiedAt: string;
}

export interface WikiNotes {
  version: number;
  /** 这一轮自修的时间。 */
  studiedAt: string;
  notes: WikiNote[];
}

const CURRENT_VERSION = 1;

/** 解析 notes.json；坏数据返回 null（而不是抛错把大脑搞挂）。 */
export function parseNotes(raw: string | null | undefined): WikiNotes | null {
  if (!raw || raw.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WikiNotes>;
    if (!Array.isArray(parsed.notes)) return null;
    const notes = parsed.notes.filter(
      (n): n is WikiNote =>
        Boolean(n) &&
        typeof n.topic === "string" &&
        typeof n.title === "string" &&
        Array.isArray(n.bullets) &&
        n.bullets.length > 0,
    );
    if (notes.length === 0) return null;
    return {
      version: typeof parsed.version === "number" ? parsed.version : CURRENT_VERSION,
      studiedAt: typeof parsed.studiedAt === "string" ? parsed.studiedAt : "",
      notes,
    };
  } catch {
    return null;
  }
}

/**
 * 压缩成能常驻提示词的一段。放在系统提示最前面 = 稳定前缀，缓存命中后很便宜。
 * 只放要点，不放原文 —— 原文留给 wiki_notes 工具按需取。
 */
export function notesDigest(notes: WikiNotes | null, maxChars = 6000): string {
  if (!notes || notes.notes.length === 0) return "";
  const head =
    "## 我读过的 Minecraft Wiki（" +
    (notes.studiedAt ? notes.studiedAt.slice(0, 10) + " 自修，" : "") +
    notes.notes.length +
    " 个条目）";
  const lines: string[] = [head, "这些是我自己查过、记下来的，比凭印象靠谱；细节拿不准时用 wiki_notes 工具翻原文。"];

  for (const note of notes.notes) {
    lines.push("### " + note.topic);
    for (const b of note.bullets) lines.push("- " + b);
    if (lines.join("\n").length > maxChars) {
      lines.push("（后面还有条目，需要时用 wiki_notes 工具查）");
      break;
    }
  }
  return lines.join("\n");
}

/** 按主题找（大小写无关，也认标题）。 */
export function findNote(notes: WikiNotes | null, topic: string): WikiNote | null {
  if (!notes) return null;
  const key = topic.trim().toLowerCase();
  if (key.length === 0) return null;
  return (
    notes.notes.find((n) => n.topic.toLowerCase() === key) ??
    notes.notes.find((n) => n.title.toLowerCase() === key) ??
    notes.notes.find((n) => n.topic.toLowerCase().includes(key)) ??
    notes.notes.find((n) => n.title.toLowerCase().includes(key)) ??
    null
  );
}

/** 目录：只有主题名，用来让模型知道"我学过哪些"。 */
export function notesIndex(notes: WikiNotes | null): string {
  if (!notes || notes.notes.length === 0) return "（还没有自修笔记）";
  return notes.notes.map((n) => n.topic).join("、");
}

/** 单条笔记的完整样子（工具返回用）。 */
export function formatNote(note: WikiNote): string {
  return [
    "【" + note.topic + "】" + note.title + "（自修于 " + note.studiedAt.slice(0, 10) + "）",
    ...note.bullets.map((b) => "- " + b),
    "",
    "原文摘要：" + note.extract,
    "来源：" + note.url,
  ].join("\n");
}
