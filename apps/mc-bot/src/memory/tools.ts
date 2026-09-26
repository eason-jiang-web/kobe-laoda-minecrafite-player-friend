import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ok, fail } from "@itto/mcp-server";
import {
  AskPlayerInput,
  areaLabel,
  askKey,
  decideAsk,
  DEFAULT_ASK_POLICY,
  ForgetLocationInput,
  HABIT,
  IndexChestInput,
  isSkillArea,
  NoteExperienceInput,
  RecallLocationsInput,
  RecallNotesInput,
  recordAsk,
  RememberLocationInput,
  RememberNoteInput,
  type BotControl,
} from "@itto/shared";
import type { WorldMemory } from "./store.js";

/**
 * MCP tools + resource for itto's world memory. Registered app-side (they hold
 * the WorldMemory + need the live BotControl), like the skill tools — keeps the
 * mcp-server package free of app state.
 */
/** Groups this run's notes; reading them back ignores the session. */
const SESSION = new Date().toISOString().slice(0, 16);

export function registerMemoryTools(server: McpServer, memory: WorldMemory, control: BotControl): void {
  server.tool(
    "remember_location",
    "Remember a named place (base, chest, point of interest). Defaults to the bot's current position if no coords given.",
    RememberLocationInput.shape,
    async ({ name, pos, kind, note }) => {
      try {
        const at = pos ?? control.getState().self.pos;
        const wp = memory.rememberLocation({ name, pos: at, dimension: control.dimension(), kind, note });
        return ok(`remembered ${wp.name} at (${wp.pos.x}, ${wp.pos.y}, ${wp.pos.z})`, wp);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.tool(
    "recall_locations",
    "List remembered places, optionally filtered by kind and sorted by distance to a coord.",
    RecallLocationsInput.shape,
    async ({ kind, near, limit }) => {
      try {
        const wps = memory.recallLocations({ kind, near, limit });
        if (wps.length === 0) return ok("nothing remembered yet", []);
        const list = wps.map((w) => `${w.name} (${w.kind}) @ (${w.pos.x}, ${w.pos.y}, ${w.pos.z})`).join("; ");
        return ok(list, wps);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.tool(
    "index_chest",
    "Open the chest at a coord, read its contents, and remember what's in it (so fetch_item can find things later).",
    IndexChestInput.shape,
    async ({ pos, label }) => {
      try {
        const contents = await control.readContainer(pos);
        const chest = memory.indexChest({ pos, dimension: control.dimension(), label, contents });
        const summary = contents.length ? contents.map((c) => `${c.item}x${c.count}`).join(", ") : "empty";
        return ok(`indexed chest at (${pos.x}, ${pos.y}, ${pos.z}): ${summary}`, chest);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.tool(
    "forget_location",
    "Forget a remembered place by name.",
    ForgetLocationInput.shape,
    async ({ name }) => {
      const removed = memory.forgetLocation(name);
      return removed ? ok(`forgot ${name}`) : fail(`no place named ${name}`);
    },
  );

  server.tool(
    "remember_note",
    "Write a short note to your own long-term memory — plans, promises, preferences, anything that is not a place or a chest. Survives restarts.",
    RememberNoteInput.shape,
    async ({ text }) => {
      try {
        memory.addNote(text, SESSION);
        return ok("noted: " + text);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.tool(
    "recall_notes",
    "Read back your recent notes. Use it to remember what you were up to, or what the player asked for earlier.",
    RecallNotesInput.shape,
    async ({ limit }) => {
      try {
        const notes = memory.recentNotes(Math.min(limit ?? 10, 50)).reverse();
        if (notes.length === 0) return ok("no notes yet", []);
        const lines = notes.map((n) => new Date(n.at).toISOString().slice(0, 16) + "  " + n.text);
        return ok(lines.join("\n"), notes);
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  /**
   * 追问预算的出口。**这是唯一允许"问他"的方式** —— 直接在 chat 里连问三句
   * 是绕不过额度检查的，所以提示词里要求：拿不准就先调这个。
   */
  server.tool(
    "ask_player",
    "问他一个你**真的没法自己决定**的问题。注意：**这个问题会直接说在游戏里**，" +
      "所以调完它不要再 chat 一遍同样的话（那就成复读机了）。同一件事最多问 " +
      DEFAULT_ASK_POLICY.maxPerTopic +
      " 次，问满会被拒绝 —— 那时候别再绕圈子，按最合理的假设直接开工，再用 chat 说一句你的理解。" +
      "能自己试出来的（砍哪棵树、走哪条路）就别问。",
    AskPlayerInput.shape,
    async ({ question, topic }) => {
      try {
        const now = Date.now();
        const records = memory.askRecords();
        // 额度按**他最后说的那件事**算，而不是按模型自己起的 topic ——
        // 实测模型会给同一件事换名字（"挖矿方向" → "wheretomine"），那样就能无限问下去。
        const request = memory.getKv("last_request");
        const key = request && request.trim().length > 0 ? "req:" + askKey(undefined, request) : askKey(topic, question);
        const verdict = decideAsk(records, key, question, now);
        if (!verdict.allowed) return fail(verdict.why ?? "别再问了，自己拍板");

        const line = question.trim().slice(0, 200);
        memory.saveAskRecords(recordAsk(records, key, line, now));
        memory.bumpHabit(HABIT.asked);
        await control.chat(line);
        const total = verdict.count + verdict.remaining;
        return ok(`asked (${verdict.count}/${total}): ${line}`, {
          asked: verdict.count,
          remaining: verdict.remaining,
        });
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  /**
   * 边玩边学：把这一趟的结果/教训写回画像。下一次唤醒的系统提示词里就有它。
   */
  server.tool(
    "note_experience",
    "把这一趟玩出来的东西记下来，越玩越准：某门本事成了/砸了（outcome），或者一条教训/" +
      "他的偏好（lesson）。记下来的东西下次唤醒时会在你的系统提示词里。只记**下次用得上**的，" +
      "别记流水账（「我挖了 3 个铁矿」这种不用记，背包里有）。",
    NoteExperienceInput.shape,
    async ({ area, outcome, lesson }) => {
      try {
        const bits: string[] = [];
        if (outcome && isSkillArea(area)) {
          memory.noteOutcome(area, outcome === "success");
          bits.push(areaLabel(area) + (outcome === "success" ? " 记一次成功" : " 记一次失败"));
        }
        const text = (lesson ?? "").trim();
        if (text.length > 0) {
          memory.addLesson(area, text);
          bits.push("记住：" + text);
        }
        if (bits.length === 0) {
          return fail("要么给 outcome（并且 area 是本事），要么给 lesson —— 不然没东西可记");
        }
        return ok(bits.join("；"));
      } catch (e) {
        return fail((e as Error).message);
      }
    },
  );

  server.resource(
    "player-profile",
    "itto://profile/current",
    {
      description:
        "你自己的经验档案：他的习惯（指令/时段/说话长度）、你每门本事的成败、记下的教训和偏好（JSON）。",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ ...memory.profile(), digest: memory.digestText() }, null, 2),
        },
      ],
    }),
  );

  server.resource(
    "world-memory",
    "itto://memory/world",
    {
      description: "Everything you remember about this world: waypoints, chest contents, notes (JSON).",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(memory.snapshot(), null, 2),
        },
      ],
    }),
  );
}
