import { describe, expect, test } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { assertPortAvailable, serveHttp } from "./index.js";

function freePort(): number {
  const probe = Bun.serve({ port: 0, fetch: () => new Response("ok") });
  const port = probe.port;
  probe.stop(true);
  if (port === undefined) throw new Error("no free port");
  return port;
}

describe("MCP 端口预检", () => {
  test("a taken port is reported clearly, and serveHttp rejects instead of hanging", async () => {
    const port = freePort();
    const squatter = Bun.serve({ port, hostname: "127.0.0.1", fetch: () => new Response("busy") });

    try {
      // The preflight the bot runs before it joins the world.
      await expect(assertPortAvailable("127.0.0.1", port)).rejects.toThrow(/already in use/);

      // And the server itself must reject (not emit an uncaught async error that
      // leaves the bot standing in the world still holding the port).
      await expect(
        serveHttp(() => new McpServer({ name: "test", version: "0.0.0" }), { host: "127.0.0.1", port }),
      ).rejects.toThrow(/already in use/);

      // The message names the port and says what to do.
      await expect(assertPortAvailable("127.0.0.1", port)).rejects.toThrow(String(port));
    } finally {
      squatter.stop(true);
    }
  });

  test("a free port passes the preflight", async () => {
    const port = freePort();
    await expect(assertPortAvailable("127.0.0.1", port)).resolves.toBeUndefined();
  });

  test("a real session still works over HTTP (verify we didn't break the server)", async () => {
    const port = freePort();
    const http = await serveHttp(() => new McpServer({ name: "test", version: "0.0.0" }), {
      host: "127.0.0.1",
      port,
    });
    try {
      const health = (await (await fetch("http://127.0.0.1:" + port + "/health")).json()) as {
        ok: boolean;
        name: string;
      };
      expect(health).toEqual({ ok: true, name: "itto-mcp" });
    } finally {
      await http.close();
    }
  });
});
