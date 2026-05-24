/**
 * drive.ts — a tiny MCP client to exercise itto's tools/skills by hand, no
 * brain needed. Great for verifying the body on a local server.
 *
 *   bun run drive list                          # list tools + resources
 *   bun run drive read itto://state/current     # read a resource
 *   bun run drive find_blocks '{"name":"any_log"}'
 *   bun run drive run_skill chop_tree
 *   bun run drive run_skill mine_vein '{"ore":"iron_ore"}'
 *   bun run drive set_goal '{"intent":{"kind":"skill","name":"chop_tree"},"label":"get wood"}'
 *
 * Endpoint defaults to http://localhost:3001/mcp (override with ITTO_MCP_URL).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const ENDPOINT = process.env.ITTO_MCP_URL ?? "http://localhost:3001/mcp";
const [, , cmd, ...rest] = process.argv;

function printToolResult(res: { content?: Array<{ type: string; text?: string }> }): void {
  for (const c of res.content ?? []) {
    if (c.type === "text" && c.text) console.log(c.text);
  }
}

async function main() {
  const client = new Client({ name: "itto-drive", version: "0.0.0" }, { capabilities: {} });
  await client.connect(new StreamableHTTPClientTransport(new URL(ENDPOINT)));

  try {
    if (!cmd || cmd === "list") {
      const tools = await client.listTools();
      console.log("tools:\n  " + tools.tools.map((t) => t.name).join("\n  "));
      const res = await client.listResources();
      console.log("resources:\n  " + res.resources.map((r) => r.uri).join("\n  "));
    } else if (cmd === "read") {
      const uri = rest[0];
      if (!uri) throw new Error("usage: drive read <uri>");
      const r = await client.readResource({ uri });
      console.log(r.contents.map((c) => ("text" in c ? c.text : "")).join("\n"));
    } else if (cmd === "run_skill") {
      const name = rest[0];
      if (!name) throw new Error("usage: drive run_skill <name> [jsonArgs]");
      const args = rest[1] ? JSON.parse(rest[1]) : undefined;
      printToolResult(await client.callTool({ name: "run_skill", arguments: { name, args } }, undefined, { timeout: 240000 }));
    } else {
      // generic: drive <tool> '<jsonArgs>'
      const args = rest[0] ? JSON.parse(rest[0]) : {};
      printToolResult(await client.callTool({ name: cmd, arguments: args }, undefined, { timeout: 240000 }));
    }
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error("drive error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
