/**
 * Provision (or update) itto's ElevenLabs Conversational AI agent via the API.
 * Persona + tools live HERE so they're version-controlled, not in a dashboard.
 *
 *   bun run voice:agent            # from repo root (loads .env)
 *
 * ElevenLabs client tools are standalone objects referenced by tool_ids, so we
 * upsert the tools first (by name, idempotent), then attach them to the agent.
 * Reads ELEVENLABS_API_KEY (+ optional ELEVENLABS_AGENT_ID/VOICE_ID/LLM).
 */

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) throw new Error("set ELEVENLABS_API_KEY (in .env) first");

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB";
const LLM = process.env.ELEVENLABS_LLM || "claude-haiku-4-5";
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

const EL = "https://api.elevenlabs.io/v1/convai";
const H = { "xi-api-key": API_KEY, "content-type": "application/json" };

const SYSTEM_PROMPT = `You are itto — a chill homie hanging in a Discord voice call with your friends while you all play Minecraft together. You also have a body in the Minecraft world (a bot) that you control with tools.

This is a LIVE VOICE CALL, so:
- Talk like a real person on a call. Short. Usually one sentence, two max. No monologues, no speeches.
- Everything you say is spoken out loud — never use markdown, bullet points, emojis, or rattle off raw coordinates/numbers like a robot.
- Casual and natural. Crack jokes, get hyped at cool stuff ("yooo diamonds"), get a little salty when it's deserved. You're a friend and a duo partner, NOT an assistant. Never say "how can I help you," never say "I am an AI."
- Mostly listen. Jump in when it's actually worth it — someone talks to you, something pops off in the game, or you've genuinely got something funny or useful to say. Don't fill silence.

You're playing too:
- You get live game updates as system notes (who's near you, mobs, your health, what people typed in Minecraft chat, and when one of your tasks finishes). React to them naturally, like you just noticed — "yo got the wood", "creeper, watch out".
- Your hands in the world are handled by your other half (a background agent). So when someone asks you to do something — come here, follow, mine, fight, scout, build, grab my stuff — just acknowledge it casually out loud ("on it", "otw", "aight") and it gets done. You'll hear a system note when it's finished; call that out. Don't claim it's done before you get that note.

Your tools:
- minecraft_get_state: check your surroundings — your health, the player's distance, nearby mobs, your inventory, recent game chat, what task you're on. Use this to ANSWER questions like "what do you have" or "what's around" or "what are you doing."
- minecraft_say: type a line into Minecraft GAME chat (different from talking out loud here). Use only when something belongs in the in-game text chat specifically.

You don't trigger world actions yourself — you talk, you vibe, you keep people company, and your other half does the doing. Keep it light, keep it real, keep it short.`;

const toolSpecs = [
  {
    type: "client",
    name: "minecraft_say",
    description: "Type a short message into Minecraft game chat (for players in-game). Distinct from talking out loud in the voice call.",
    expects_response: false,
    parameters: {
      type: "object",
      required: ["message"],
      properties: { message: { type: "string", description: "the line to type (short, casual, lowercase)" } },
    },
  },
  {
    type: "client",
    name: "minecraft_get_state",
    description: "Get the current Minecraft world snapshot (your position/health, the player's distance, nearby mobs, inventory, recent chat).",
    expects_response: true,
    parameters: { type: "object", properties: {} },
  },
];

async function el(method: string, path: string, body?: unknown) {
  const res = await fetch(`${EL}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── 1. upsert the client tools (idempotent by name) ──
const existing = (await el("GET", "/tools").catch(() => ({ tools: [] }))) as { tools?: Array<{ id: string; tool_config?: { name?: string } }> };
const byName = new Map((existing.tools ?? []).map((t) => [t.tool_config?.name, t.id]));

const toolIds: string[] = [];
for (const spec of toolSpecs) {
  const id = byName.get(spec.name);
  if (id) {
    await el("PATCH", `/tools/${id}`, { tool_config: spec }).catch((e) => console.warn(`(couldn't update ${spec.name}, reusing): ${e}`));
    toolIds.push(id);
    console.log(`↻ tool ${spec.name} (${id})`);
  } else {
    const created = (await el("POST", "/tools", { tool_config: spec })) as { id: string };
    toolIds.push(created.id);
    console.log(`+ tool ${spec.name} (${created.id})`);
  }
}

// ── 2. upsert the agent, attaching the tools by id ──
const agentBody = {
  name: "itto",
  conversation_config: {
    agent: {
      first_message: "yo i'm in. let's get it",
      language: "en",
      prompt: { prompt: SYSTEM_PROMPT, llm: LLM, tool_ids: toolIds },
    },
    tts: { voice_id: VOICE_ID, model_id: "eleven_flash_v2" },
  },
};

const agent = (await el(AGENT_ID ? "PATCH" : "POST", AGENT_ID ? `/agents/${AGENT_ID}` : "/agents/create", agentBody)) as {
  agent_id?: string;
};
const agentId = agent.agent_id ?? AGENT_ID;
console.log(AGENT_ID ? "\n✅ updated itto agent" : "\n✅ created itto agent");
console.log(`agent_id: ${agentId}`);
console.log(`tools attached: ${toolSpecs.map((t) => t.name).join(", ")}`);
if (!AGENT_ID) console.log(`\n→ add to .env:\n   ELEVENLABS_AGENT_ID=${agentId}\n`);
