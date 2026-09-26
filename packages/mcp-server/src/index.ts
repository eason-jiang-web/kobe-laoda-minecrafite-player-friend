export { createMcpServer } from "./server.js";
export { serveHttp, assertPortAvailable } from "./http.js";
// Re-exported so app-side tool registrations (skills, memory, goals) can reuse
// the exact same MCP result envelope as the built-in tools.
export { ok, fail } from "./tools/_util.js";
// wiki 查询也放出来：自修脚本（apps/brain-deepseek/scripts/study-wiki.ts）复用它取条目，
// 免得两处各写一份 MediaWiki 调用。
export { formatWikiAnswer, lookupWiki, MAX_EXTRACT_CHARS, type WikiPage } from "./tools/wiki.js";
