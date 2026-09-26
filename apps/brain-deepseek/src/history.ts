/**
 * A nudge spawns a fresh brain process, so the only way itto remembers what it
 * just said is a file on disk. We keep a short rolling log of (what woke me ->
 * what I said / did) and feed it back as context, which is the difference
 * between a buddy and a goldfish.
 *
 * Lives in data/ (gitignored) next to the world memory db.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface HistoryEntry {
  /** epoch ms */
  at: number;
  /** what woke the brain (the nudge reason / prompt) */
  reason: string;
  /** the final chat line it decided to say, if any */
  said: string;
  /** MCP tools it called */
  did: string[];
}

export function loadHistory(file: string, keep = 8): HistoryEntry[] {
  try {
    const raw = readFileSync(file, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(-keep);
  } catch {
    return [];
  }
}

export function appendHistory(file: string, entry: HistoryEntry, keep = 24): void {
  try {
    const all = loadHistory(file, keep * 4);
    all.push(entry);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(all.slice(-keep), null, 2));
  } catch {
    // history is a nicety — never let it break a turn
  }
}

function isEntry(v: unknown): v is HistoryEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.at === "number" && typeof e.reason === "string" && typeof e.said === "string";
}

export function formatHistory(entries: HistoryEntry[], now = Date.now()): string {
  return entries
    .map((e) => {
      const mins = Math.max(0, Math.round((now - e.at) / 60_000));
      const when = mins < 1 ? "just now" : mins + "m ago";
      const said = e.said ? ' said "' + clip(e.said, 140) + '"' : " stayed quiet";
      const did = e.did.length > 0 ? " [" + e.did.join(", ") + "]" : "";
      return "- " + when + " | " + clip(e.reason, 160) + " ->" + said + did;
    })
    .join("\n");
}

function clip(s: string, max: number): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max - 1) + "…" : oneLine;
}
