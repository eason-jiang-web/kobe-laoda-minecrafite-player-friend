import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { GameState } from "@itto/shared";
import { logger } from "./log.js";

const log = logger("mc");

/**
 * MCP client to the itto-mc server (the running Minecraft bot). Used two ways:
 *   - execute the ElevenLabs agent's tool calls (say / run_skill) — control
 *   - pull the live world snapshot to push as conversation context
 */
export class McClient {
  private client: Client | null = null;

  constructor(private readonly url: string) {}

  get connected(): boolean {
    return this.client !== null;
  }

  async connect(): Promise<void> {
    if (this.client) return; // idempotent — safe to call from reconnect loop
    const client = new Client({ name: "itto-voice", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(this.url));
    await client.connect(transport);
    this.client = client;
    log.info(`connected to itto-mc at ${this.url}`);
  }

  private ensure(): Client {
    if (!this.client) throw new Error("itto-mc not connected (is the bot running? `bun run bot`)");
    return this.client;
  }

  /** Type a line in Minecraft chat. */
  async say(message: string): Promise<string> {
    return this.call("chat", { message });
  }

  /** Run a seed skill synchronously (blocks until done) — for quick skills only. */
  async runSkill(skill: string, args?: Record<string, unknown>): Promise<string> {
    return this.call("run_skill", { name: skill, args });
  }

  /**
   * Set a goal (non-blocking): the bot pursues the skill in the background and
   * reports completion via state (lastGoal). Use for anything that takes a beat
   * (chop, mine, fetch, scout, build, combat) so the voice tool call doesn't
   * hang waiting on pathfinding.
   */
  async setGoal(skill: string, args?: Record<string, unknown>): Promise<string> {
    const label = skill.replace(/_/g, " ");
    return this.call("set_goal", { intent: { kind: "skill", name: skill, args }, label });
  }

  /** Compact world snapshot as text (for the get_state tool). */
  async getStateText(): Promise<string> {
    const res = await this.ensure().readResource({ uri: "itto://state/current.txt" });
    const first = res.contents?.[0];
    return (first && "text" in first ? (first.text as string) : "") || "(no state)";
  }

  /** Structured world snapshot (for diffing into context pushes). */
  async getState(): Promise<GameState> {
    const res = await this.ensure().readResource({ uri: "itto://state/current" });
    const first = res.contents?.[0];
    const text = first && "text" in first ? (first.text as string) : "{}";
    return JSON.parse(text) as GameState;
  }

  private async call(name: string, args: Record<string, unknown>): Promise<string> {
    const res = await this.ensure().callTool({ name, arguments: args });
    const content = Array.isArray(res.content) ? res.content : [];
    const text = content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join(" ");
    return text || "(ok)";
  }
}
