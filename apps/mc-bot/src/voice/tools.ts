import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ok } from "@itto/mcp-server";
import { SpeakInput } from "@itto/shared";
import { pushSpeech, drainSpeech } from "./outbox.js";

/**
 * Voice tools. `speak` is how the brain (jabby) talks out loud in the call —
 * it queues a line that the voice bridge drains and voices via ElevenLabs.
 * `drain_speech` is the bridge's side (return + clear the queue). App-side
 * because the queue is process state.
 */
export function registerVoiceTools(server: McpServer): void {
  server.tool(
    "speak",
    "Say a short line OUT LOUD in the Discord voice call (this is how you talk to your friends while playing — distinct from in-game text chat). Keep it casual and brief.",
    SpeakInput.shape,
    async ({ text }) => {
      pushSpeech(text);
      return ok("said");
    },
  );

  server.tool(
    "drain_speech",
    "(voice bridge only) Return and clear the queued lines the brain wants spoken.",
    {},
    async () => {
      const lines = drainSpeech();
      return ok(lines.length ? `${lines.length} line(s)` : "empty", lines);
    },
  );
}
