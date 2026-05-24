export { createMcpServer } from "./server.js";
export { serveHttp } from "./http.js";
// Re-exported so app-side tool registrations (skills, memory, goals) can reuse
// the exact same MCP result envelope as the built-in tools.
export { ok, fail } from "./tools/_util.js";
