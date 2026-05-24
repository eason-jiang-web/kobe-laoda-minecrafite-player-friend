import express from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Serve MCP over Streamable HTTP so the brain (a separate process, possibly a
 * separate machine) can reach it at http://host:port/mcp.
 *
 * One transport AND one McpServer instance per session — an McpServer can only
 * bind a single transport, so every session (brain, voice bridge, dev driver)
 * gets its own via the `makeServer` factory. Sessions are keyed by the
 * Mcp-Session-Id header.
 */
export async function serveHttp(
  makeServer: () => McpServer,
  opts: { host: string; port: number },
): Promise<{ close: () => Promise<void> }> {
  const app = express();
  app.use(express.json());

  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.all("/mcp", async (req, res) => {
    try {
      const sessionId = req.header("mcp-session-id");
      let transport = sessionId ? transports.get(sessionId) : undefined;

      if (!transport) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transports.set(id, transport!);
          },
        });
        transport.onclose = () => {
          if (transport!.sessionId) transports.delete(transport!.sessionId);
        };
        // Fresh server per session — an McpServer binds exactly one transport.
        await makeServer().connect(transport);
      }

      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      // Never let a bad request take down the bot process.
      // eslint-disable-next-line no-console
      console.error("[mcp] request error:", (e as Error).message);
      if (!res.headersSent) res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/health", (_req, res) => res.json({ ok: true, name: "itto-mcp" }));

  return new Promise((resolve) => {
    const httpServer = app.listen(opts.port, opts.host, () => {
      // eslint-disable-next-line no-console
      console.log(`[mcp] listening on http://${opts.host}:${opts.port}/mcp`);
      resolve({
        close: () => new Promise<void>((r) => httpServer.close(() => r())),
      });
    });
  });
}
