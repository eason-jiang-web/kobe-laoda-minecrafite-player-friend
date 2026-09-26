/**
 * itto's brain on DeepSeek.
 *
 * The bot spawns this once per "nudge" (see apps/mc-bot/src/slow-loop/agent-sink.ts):
 *
 *     <BRAIN_CMD> "<prompt>"
 *
 * i.e. we get one prompt — "eason said \"itto\", here's the world snapshot" —
 * and we get to look at the live world, act, talk, or stay quiet. We reach the
 * body through the itto MCP server (ITTO_MCP_URL), exactly like Hermes would.
 *
 * What happens per run:
 *   1. connect to itto-mc over MCP
 *   2. list its tools + resources and hand them to DeepSeek as function tools
 *   3. loop: model -> tool calls -> results -> model ... until it stops calling
 *   4. remember what we said/did in data/brain-history.json, exit
 *
 * Env (all optional except the key):
 *   DEEPSEEK_API_KEY          required
 *   DEEPSEEK_BASE_URL         default https://api.deepseek.com
 *   DEEPSEEK_MODEL            default deepseek-chat (deepseek-reasoner can't call tools)
 *   ITTO_MCP_URL              default http://localhost:3001/mcp
 *   BRAIN_MAX_STEPS           default 6   (model round-trips per nudge)
 *   BRAIN_BUDGET_MS           default 120000 (hard wall-clock cap for the run)
 *   BRAIN_TOOL_TIMEOUT_MS     default 120000 (per MCP call; skills are slow)
 *   BRAIN_MAX_TOOL_CHARS      default 4000 (tool output fed back to the model)
 *   BRAIN_MAX_TOKENS          default 2048
 *   BRAIN_TEMPERATURE         default 0.8
 *   BRAIN_HISTORY_PATH        default data/brain-history.json
 *   BRAIN_PROFILE_PATH        default data/profile-digest.txt (他的习惯+你的熟练度，身体写的)
 *   BRAIN_HISTORY_KEEP        default 24
 *   BRAIN_DEBUG=1             verbose trace on stderr
 *
 * Manual runs:
 *   bun apps/brain-deepseek/src/index.ts --check      # just list the MCP surface
 *   bun apps/brain-deepseek/src/index.ts "say hi"
 *   echo "say hi" | bun apps/brain-deepseek/src/index.ts -
 */
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { GUIDE_KNOWLEDGE, notesDigest, parseNotes, SYSTEM_PROMPT, type WikiNotes } from "@itto/shared";
import { DeepSeekClient, type ChatMessage, type ToolCall, type ToolDefinition } from "./deepseek.js";
import { normalizeSchema } from "./schema.js";
import { appendHistory, formatHistory, loadHistory } from "./history.js";
import { appendTurn, type TrainingToolCall } from "./training-log.js";

/** Synthetic tool that exposes MCP resources (which aren't tools) to the model. */
const READ_RESOURCE = "read_resource";

type ListedTools = Awaited<ReturnType<Client["listTools"]>>;
type McpTool = ListedTools["tools"][number];
type ListedResources = Awaited<ReturnType<Client["listResources"]>>;
type McpResource = ListedResources["resources"][number];

/** The slice of an MCP tool result we actually forward to the model. */
interface ToolCallResult {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
  structuredContent?: unknown;
}

interface BrainConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  mcpUrl: string;
  maxSteps: number;
  budgetMs: number;
  toolTimeoutMs: number;
  maxToolChars: number;
  maxTokens: number;
  temperature: number;
  historyPath: string;
  historyKeep: number;
  /** 自修笔记的路径（见 apps/brain-deepseek/scripts/study-wiki.ts）。 */
  wikiNotesPath: string;
  /** 画像摘要的路径（mc-bot 边玩边写：他的习惯 + 你的熟练度 + 教训）。 */
  profilePath: string;
  /** Write one JSONL line per wake into data/training (see training-log.ts). */
  trainLog: boolean;
  /** Also store the full prompt (big files, but complete training pairs). */
  trainFullPrompt: boolean;
  debug: boolean;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

function loadConfig(): BrainConfig {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    mcpUrl: process.env.ITTO_MCP_URL ?? "http://localhost:3001/mcp",
    maxSteps: num("BRAIN_MAX_STEPS", 6),
    budgetMs: num("BRAIN_BUDGET_MS", 120_000),
    toolTimeoutMs: num("BRAIN_TOOL_TIMEOUT_MS", 120_000),
    maxToolChars: num("BRAIN_MAX_TOOL_CHARS", 4000),
    maxTokens: num("BRAIN_MAX_TOKENS", 2048),
    temperature: num("BRAIN_TEMPERATURE", 0.8),
    historyPath: process.env.BRAIN_HISTORY_PATH ?? "data/brain-history.json",
    /** 自修笔记（bun run study:wiki 的产物）—— 要点会常驻系统提示词。 */
    wikiNotesPath: process.env.BRAIN_WIKI_NOTES_PATH ?? "data/wiki/notes.json",
    profilePath: process.env.BRAIN_PROFILE_PATH ?? "data/profile-digest.txt",
    historyKeep: num("BRAIN_HISTORY_KEEP", 24),
    trainLog: (process.env.BRAIN_TRAIN_LOG ?? "1") !== "0",
    trainFullPrompt: process.env.BRAIN_TRAIN_FULL === "1",
    debug: process.env.BRAIN_DEBUG === "1" || process.env.BRAIN_DEBUG === "true",
  };
}

function trace(cfg: BrainConfig, msg: string): void {
  if (cfg.debug) process.stderr.write("[brain] " + msg + "\n");
}

/** One compact line on stdout — the bot logs this at debug level. */
function summary(msg: string): void {
  process.stdout.write("[brain] " + msg + "\n");
}

/**
 * 读自修笔记。坏文件/没有都返回 null（不能让笔记把大脑搞挂）。
 */
function loadWikiNotes(path: string): WikiNotes | null {
  try {
    return parseNotes(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * 读身体写的画像摘要。没有/坏了都返回空串 —— 经验读不到不该影响开工。
 */
function loadProfileDigest(path: string): string {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
}

async function readPrompt(): Promise<string> {
  const args = process.argv.slice(2);
  if (args[0] === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk as Uint8Array));
    return Buffer.concat(chunks).toString("utf8").trim();
  }
  return args.join(" ").trim();
}

/**
 * The standing instructions. SYSTEM_PROMPT (packages/shared) is the personality
 * — the same one Hermes would get — and everything below is the operational
 * reality of being woken up inside a running Minecraft world.
 */
function buildSystemPrompt(
  resources: McpResource[],
  wikiNotes: WikiNotes | null,
  profileText: string,
): string {
  const lines = [
    SYSTEM_PROMPT,
    "",
    // 静态的 Minecraft 常识，永远在。放在最前面 = 稳定前缀，能吃到上下文缓存，
    // 所以"常驻"其实很便宜；不懂世界规则就谈不上灵活。
    GUIDE_KNOWLEDGE,
    // 它自己读 wiki 学来的笔记（bun run study:wiki 的产物）。
    // 同样是稳定前缀 —— 常驻不贵，但比"凭印象"准得多。
    notesDigest(wikiNotes),
    // 边玩边攒的画像（他的习惯 / 你的熟练度 / 教训）。身体写文件、这里读进来。
    // 放在静态常识后面 = 前面那截稳定前缀还能吃到上下文缓存。
    profileText,
    "",
    "## How you are running right now / 你现在是怎么跑的",
    "你是牢大（Laoda）的大脑：一个 Mineflayer 机器人正站在你兄弟的 Minecraft 世界里。"
      + "身体觉得有值得一看的事才会叫醒你，大多数时候不需要回复。",
    "说话用中文，短句，嗓门大；招牌台词「What can I say? Mamba out!」关键时候甩一句 —— 具体人设以上面那段为准。",
    "",
    "Rules of engagement:",
    "- The snapshot in the prompt is already a moment stale. Read live state first: "
      + "call read_resource with itto://state/current.txt (or itto://state/current for JSON).",
    "- To speak in game, call the chat tool with ONE short, casual line (中文，短句，偶尔一句 man what can I say). "
      + "有话就说，别憋着；但没什么可说的时候也不用硬找话 —— 安静地跟着也是一种陪伴。",
    "- For anything multi-step (chop a tree, mine a vein, fetch an item, fight mobs, build), "
      + "call set_goal with an intent and let the body carry it out. Check the goal line in the snapshot first "
      + "- never re-set a goal that is already active.",
    "- 背包、方块、生物的名字都是**中文**（橡木原木 / 粗铁 / 下界合金锭 / 僵尸），" +
      "因为你看到的就是你在游戏里看到的那个名字。工具参数里中文名和英文 id 都能用" +
      "（mine_block、find_blocks、craft_item 都认「橡木原木」）。",
    "- 快照里 modes 如果是「自由活动(#free)」，说明他让你自己玩 —— 别答应「马上到」，"
      + "要告诉他打 #back 你才回去。如果是「停火(#stop)」，别承诺打怪 —— 让他打 #nonstop 你才重新动手。"
      + "如果是「原地待命(#stay)」，别自己跑开干活；「闭嘴(#quiet)」时他不叫你你就别开口。",
    "- 他说「过来 / 快过来 / tp / 传送 / 瞬移过来」→ 优先调 teleport_to_player（瞬间到，不用走）。"
      + "这个需要他给你 op；如果它返回说需要 op，就照实跟他讲「你得先 /op 我一下」，然后改用 move_to 走过去。",
    "- 你也能用服务器的指令栏：server_command（例如 'time set day'、'weather clear'、'give eason diamond 3'、'summon cow'）。"
      + "需要 op，而且只有 eason 放行的那批指令能跑（被拒绝时它会告诉你能用哪些）—— 别浪费回合去试 /fill、/kill、/stop 这种。",
    "- 找村庄 / 找地方：run_skill explore_for（args 里给 target：village / water / lava / animal / chest）。"
      + "它会自己走出去绕圈找，找到坐标再回来 —— 不要用「跟着他」来糊弄这种任务。",
    "- 「给我 N 个 X」→ set_goal {kind:'collect', item:'oak_log', count:32}：它会一直弄，直到背包里真的有 32 个才算完成，"
      + "中途失败也会告诉你弄到多少了。",
    "- 「把你身上的 X 给我」→ set_goal {kind:'deliver', items:[{name:'stone_pickaxe',count:1}]}：它会走到他面前丢下，"
      + "等他真的捡走才算完成（背包里不够会直接失败并说明缺什么）。",
    "- 任务结束会有一条「任务结算」唤醒：跟他说结果（拿到多少 / 为什么没成），然后你就空闲了，等他的下一个任务。",
    "- You have hands: move_to, look_at, dig_at, mine_block, place_block, equip, craft_item, run_skill, find_blocks, "
      + "nearby_blocks, look_detect, collect_drops... Actually do things instead of narrating them.",
    "- 细节拿不准就查 wiki，别编：调 wiki_lookup（比如「僵尸 生成条件」「刷怪塔」「附魔台」）。"
      + "它返回中文摘要 + 来源链接。**基础常识不用查**（木头能烧、钻石要铁镐），"
      + "只有版本细节、具体数值、生成条件这类容易记混的才查。查到什么就按什么说，并可以说一句「我刚查了 wiki」。",
    "- 该干嘛拿不准时调 assess_progress：给你主线进度（走到第几步、这步该做什么）+ 每项工程"
      + "（农场/储物间/刷怪塔/传送门/附魔台/铁傀儡农场…）的开工条件和缺料清单。纯计算，免费，随便调。",
    "- **该问就问，但最多三次**：他说话指代不清的时候（「去那边」「老地方」「那个东西」「随便弄点」），"
      + "或者要动他的东西（丢装备、拆建筑、下界这类不可逆的）→ 用 ask_player 问一句，"
      + "别自己瞎猜然后跑冤枉路。**ask_player 本身就是说话** —— 调完它别再 chat 一遍同样的问题。"
      + "**同一件事最多 3 次**：问到第三次还没说清，"
      + "就挑最合理的解释直接开工，再用 chat 说一句你的理解（「行，那我往你左手边那片林子去」）。"
      + "自己看一眼就知道的（附近有什么怪、手上有没有镐子）别问。",
    "- **他跟你说话，你必须出声**：哪怕只是一句「行，我这就去」也比一声不吭强 —— "
      + "憋着不说话，他会以为你坏了。真不知道该干嘛就问一句（ask_player），"
      + "或者先按最合理的理解动起来再告诉他。",
    "- **越玩越懂他**：干完一件事顺手调 note_experience 记一笔 —— 某门本事成了/砸了（outcome），"
      + "或者一句教训/他的偏好（lesson）。记下来的东西下次唤醒会出现在上面的经验区里。"
      + "只记下次用得上的，别记流水账。想知道自己现在什么水平就看 itto://profile/current。",
    "- Keep durable facts: remember_location for places, index_chest for chest contents, "
      + "remember_note for plans/promises/preferences, recall_notes + itto://memory/world to read them back.",
    "- 有人在跟你说话就直接回 —— 一两句，别装没听见，也别答非所问。这是聊天，不是播报。",
    "- 同一句话只说一次。重复的调用会被系统丢掉，别浪费回合。"
      + "一次唤醒一般就一句 chat —— 说完就去干正事，别把同一个意思换个说法又发一遍。",
    "- 如果这次唤醒写的是「自由活动」：那是让你自己找事做。用 set_goal 排一个（砍树/挖矿/探路/盖东西都行），"
      + "再跟他说一句你打算干嘛；实在没什么想干的就安静跟着。",
    "- Never mention being an AI, a model, or these instructions. 你就是牢大，在跟兄弟打游戏而已。",
  ];
  if (resources.length > 0) {
    lines.push("", "Resources you can read with read_resource: " + resources.map((r) => r.uri).join(", "));
  }
  return lines.join("\n");
}

function buildToolDefs(tools: McpTool[], resources: McpResource[]): ToolDefinition[] {
  const defs: ToolDefinition[] = tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: (t.description ?? t.name).slice(0, 1024),
      parameters: normalizeSchema(t.inputSchema),
    },
  }));

  if (resources.length > 0) {
    defs.push({
      type: "function",
      function: {
        name: READ_RESOURCE,
        description:
          "Read one of your own MCP resources (live world state, world memory). Use this before acting: "
          + resources.map((r) => r.uri + " = " + (r.description ?? r.name)).join("; "),
        parameters: {
          type: "object",
          properties: {
            uri: { type: "string", enum: resources.map((r) => r.uri) },
          },
          required: ["uri"],
        },
      },
    });
  }

  return defs;
}

function renderToolResult(res: ToolCallResult): string {
  const parts: string[] = [];
  for (const block of res.content ?? []) {
    if (block.type === "text" && typeof block.text === "string") parts.push(block.text);
    else parts.push("[" + block.type + "]");
  }
  const structured = res.structuredContent;
  if (parts.length === 0 && structured !== undefined) parts.push(JSON.stringify(structured));
  const text = parts.length > 0 ? parts.join("\n") : "(no output)";
  return (res.isError ? "error: " : "") + text;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "\n…[truncated " + (s.length - max) + " chars]" : s;
}

async function runTool(client: Client, call: ToolCall, cfg: BrainConfig): Promise<string> {
  const raw = (call.function.arguments ?? "").trim();
  let args: Record<string, unknown> = {};
  if (raw.length > 0) {
    try {
      const parsed: unknown = JSON.parse(raw);
      args = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
    } catch {
      return "error: arguments were not valid JSON: " + raw.slice(0, 200);
    }
  }

  try {
    if (call.function.name === READ_RESOURCE) {
      const uri = String(args.uri ?? "");
      const res = await client.readResource({ uri });
      const text = res.contents
        .map((c) => ("text" in c && typeof c.text === "string" ? c.text : JSON.stringify(c)))
        .join("\n");
      return truncate(text, cfg.maxToolChars);
    }
    const res = (await client.callTool({ name: call.function.name, arguments: args }, undefined, {
      timeout: cfg.toolTimeoutMs,
    })) as unknown as ToolCallResult;
    return truncate(renderToolResult(res), cfg.maxToolChars);
  } catch (e) {
    // Hand the failure back to the model instead of dying — it can adapt.
    return "error: " + (e instanceof Error ? e.message : String(e));
  }
}

/**
 * A server with no resources registered answers listResources with
 * "method not found" instead of an empty list, and a brain that dies over a
 * missing optional capability is a bad brain.
 */
async function listResourcesOrEmpty(client: Client, cfg: BrainConfig): Promise<McpResource[]> {
  try {
    return (await client.listResources()).resources;
  } catch (e) {
    trace(cfg, "no resources available (" + (e instanceof Error ? e.message : String(e)) + ")");
    return [];
  }
}

async function check(client: Client, cfg: BrainConfig): Promise<void> {
  const tools = await client.listTools();
  const resources = await listResourcesOrEmpty(client, cfg);
  summary(cfg.model + " via " + cfg.baseUrl + " -> " + cfg.mcpUrl);
  summary("tools (" + tools.tools.length + "): " + tools.tools.map((t) => t.name).join(", "));
  summary("resources (" + resources.length + "): " + resources.map((r) => r.uri).join(", "));
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const checkOnly = process.argv.slice(2)[0] === "--check";
  const prompt = checkOnly ? "" : await readPrompt();

  if (!checkOnly && prompt.length === 0) {
    process.stderr.write(
      "usage: bun apps/brain-deepseek/src/index.ts \"<prompt>\"\n"
        + "       bun apps/brain-deepseek/src/index.ts --check   (list the MCP surface, no model call)\n"
        + "       echo \"<prompt>\" | bun apps/brain-deepseek/src/index.ts -\n",
    );
    process.exit(2);
  }

  const ds = new DeepSeekClient({
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
  });

  const client = new Client({ name: "itto-brain-deepseek", version: "0.0.0" }, { capabilities: {} });
  await client.connect(new StreamableHTTPClientTransport(new URL(cfg.mcpUrl)));
  trace(cfg, "connected to " + cfg.mcpUrl);

  try {
    if (checkOnly) {
      await check(client, cfg);
      return;
    }

    const { tools } = await client.listTools();
    if (tools.length === 0) {
      throw new Error("the MCP server at " + cfg.mcpUrl + " exposes no tools — is itto's bot actually running?");
    }
    const resources = await listResourcesOrEmpty(client, cfg);
    const toolDefs = buildToolDefs(tools, resources);
    trace(cfg, "model=" + cfg.model + " tools=" + toolDefs.length);

    const history = loadHistory(cfg.historyPath, 8);
    // 自修笔记（bun run study:wiki 产生）。读不到就当作没有 —— 不影响正常开工。
    const wikiNotes = loadWikiNotes(cfg.wikiNotesPath);
    if (wikiNotes) trace(cfg, "wiki notes: " + wikiNotes.notes.length + " 条");
    const profileText = loadProfileDigest(cfg.profilePath);
    if (profileText.length > 0) trace(cfg, "profile digest: " + profileText.length + " chars");
    const messages: ChatMessage[] = [
      { role: "system", content: buildSystemPrompt(resources, wikiNotes, profileText) },
    ];
    const priorContext = formatHistory(history);
    if (priorContext.length > 0) {
      messages.push({
        role: "system",
        content: "What you already said and did recently, oldest first:\n" + priorContext,
      });
    }
    messages.push({ role: "user", content: prompt });

    const did: string[] = [];
    /** Every tool call with its real result — this is the training data. */
    const toolLog: TrainingToolCall[] = [];
    /** Fingerprints of calls already made this run — see the loop below. */
    const already = new Set<string>();
    const startedAt = Date.now();
    let said = "";
    const deadline = startedAt + cfg.budgetMs;

    for (let step = 0; step < cfg.maxSteps; step++) {
      if (Date.now() > deadline) {
        trace(cfg, "budget exhausted after " + step + " step(s)");
        break;
      }

      const reply = await ds.complete(messages, toolDefs);
      messages.push(reply);

      const calls = reply.tool_calls ?? [];
      if (calls.length === 0) {
        said = (reply.content ?? "").trim();
        break;
      }

      trace(cfg, "step " + (step + 1) + ": " + calls.map((c) => c.function.name).join(", "));
      for (const call of calls) {
        // The model sometimes repeats itself in the same turn ("say this" twice).
        // In game that means the same line twice in chat, which looks broken.
        const fingerprint = call.function.name + " " + (call.function.arguments ?? "");
        if (already.has(fingerprint)) {
          trace(cfg, "skipped duplicate call: " + call.function.name);
          toolLog.push({ name: call.function.name, args: call.function.arguments ?? "", result: "", skipped: true });
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: "skipped: you already did exactly this a moment ago — don't repeat yourself",
          });
          continue;
        }
        already.add(fingerprint);

        const result = await runTool(client, call, cfg);
        did.push(call.function.name);
        toolLog.push({ name: call.function.name, args: call.function.arguments ?? "", result });
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }

    appendHistory(
      cfg.historyPath,
      { at: Date.now(), reason: prompt, said: said.slice(0, 240), did },
      cfg.historyKeep,
    );

    // Training data: what happened -> what it decided -> what came back.
    if (cfg.trainLog) {
      try {
        appendTurn({
          id: crypto.randomUUID(),
          at: startedAt,
          model: cfg.model,
          // The sink hands these over as env vars, so we don't have to parse
          // our own prompt back apart.
          reason: process.env.ITTO_BRAIN_REASON ?? prompt.slice(0, 400),
          state: process.env.ITTO_BRAIN_STATE ?? "",
          tools: toolLog,
          said,
          steps: did.length,
          ms: Date.now() - startedAt,
          ...(cfg.trainFullPrompt ? { prompt } : {}),
        });
      } catch (e) {
        trace(cfg, "training log failed: " + (e as Error).message);
      }
    }

    summary(
      "done · model=" + cfg.model + " steps=" + did.length
        + (said.length > 0 ? " · said: " + said.replace(/\s+/g, " ") : " · stayed quiet"),
    );
  } finally {
    await client.close().catch(() => undefined);
  }
}

main().catch((e: unknown) => {
  process.stderr.write("[brain] " + (e instanceof Error ? e.message : String(e)) + "\n");
  process.exit(1);
});
