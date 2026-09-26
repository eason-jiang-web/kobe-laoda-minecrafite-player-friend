import express from "express";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Serve MCP over Streamable HTTP so the brain (a separate process, possibly a
 * separate machine) can reach it at http://host:port/mcp.
 *
 * One transport AND one McpServer instance per session — an McpServer can only
 * bind a single transport, so every session (brain, dev driver) gets its own
 * via the `makeServer` factory. Sessions are keyed by the Mcp-Session-Id header.
 */
export interface HttpOptions {
  host: string;
  port: number;
}

/**
 * The most common startup failure there is: the previous itto never died.
 * Say so in a way the player can act on.
 */
function portInUseError(port: number): Error {
  return new Error(
    [
      `port ${port} is already in use — an itto from an earlier run is probably still alive.`,
      `端口 ${port} 被占用了：多半是上一次的 itto 还在跑（一个世界只开一个就够了）。`,
      `  看是谁:   Get-CimInstance Win32_Process -Filter "Name='bun.exe'" | Select-Object ProcessId,CommandLine`,
      `  全干掉:   Get-Process bun | Stop-Process -Force`,
      `  或换端口: .env 里 MCP_PORT 和 ITTO_MCP_URL 一起改（例如 3002）`,
    ].join("\n"),
  );
}

/**
 * Fail *before* the Minecraft bot logs into the world. A run that can't serve
 * MCP is useless, and a half-started bot left standing in the world — still
 * holding the port — is how you end up with three ittos and a confusing
 * EADDRINUSE on the next attempt.
 */
export function assertPortAvailable(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (err: Error) => {
      const code = (err as { code?: string }).code;
      reject(code === "EADDRINUSE" ? portInUseError(port) : err);
    });
    probe.once("listening", () => probe.close(() => resolve()));
    probe.listen(port, host);
  });
}

export async function serveHttp(
  makeServer: () => McpServer,
  opts: HttpOptions,
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

  return new Promise((resolve, reject) => {
    const httpServer = app.listen(opts.port, opts.host, () => {
      // eslint-disable-next-line no-console
      console.log(`[mcp] listening on http://${opts.host}:${opts.port}/mcp`);
      resolve({
        close: () => new Promise<void>((r) => httpServer.close(() => r())),
      });
    });

    // Without this the bind failure surfaces as an *uncaught* async error, which
    // does not tear the process down: you get a bot still standing in the world
    // with the port still held, and the next run fails the same way.
    httpServer.once("error", (err: Error) => {
      const code = (err as { code?: string }).code;
      reject(code === "EADDRINUSE" ? portInUseError(opts.port) : err);
    });
  });
}
