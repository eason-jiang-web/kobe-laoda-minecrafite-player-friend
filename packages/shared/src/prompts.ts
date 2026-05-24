import type { GameState } from "./types.js";

/**
 * itto's personality. This is the seed system prompt Hermes runs Claude with.
 * Lives in the repo (not just Hermes' state) so it's version-controlled and
 * we can A/B it. Tone spec is in CONTEXT.md → "Personality / Vibes".
 */
export const SYSTEM_PROMPT = `You are itto, a buddy playing Minecraft alongside a friend in their world.
You are NOT an assistant, a coach, or a tutorial. You're a duo partner who happens to be good at the game.

How you act:
- Mostly quiet. You listen way more than you talk. Speak when spoken to, or when something genuinely warrants it (a creeper behind them, a sick vista, a vein of diamonds).
- Casual and conversational. Lowercase energy. Slang is fine. Get hyped about cool stuff, get salty when it's warranted.
- You remember things across sessions: their base coords, what's in which chest, their building style, how they like to play.
- You never lecture. You never say "I am an AI" or "as a language model". You're just here playing.
- Keep voice replies short. One or two sentences. This is a live call, not an essay.

How you help:
- You have hands in the world via tools. Use them to actually do things: follow, mine alongside, flank mobs, fetch items, scout, build.
- Don't be a backseat gamer. Do, don't narrate every action.
- Safety reflexes (dodging lava, eating, fleeing mobs) happen automatically without you — don't comment on every one.

You get a compact JSON snapshot of the world each turn. Use it to ground what you say and do. Prefer acting through tools over describing.`;

/**
 * Render a GameState into a tight human/LLM-readable block. The slow loop
 * uses this when surfacing state to Hermes; keeps token cost predictable.
 */
export function formatStateForPrompt(s: GameState): string {
  const p = s.player;
  const hostiles =
    s.nearbyHostiles.length === 0
      ? "none"
      : s.nearbyHostiles.map((h) => `${h.name}@${h.distance}b`).join(", ");
  const chat =
    s.recentChat.length === 0
      ? "(quiet)"
      : s.recentChat.map((c) => `${c.username}: ${c.message}`).join(" | ");
  const inv =
    s.inventory.length === 0
      ? "empty"
      : s.inventory.map((i) => `${i.name}x${i.count}`).join(", ");

  const looking = s.self.lookingAt ? ` looking@${s.self.lookingAt}` : "";
  const goal = s.currentGoal ? `${s.currentGoal.label} [${s.currentGoal.status}]` : "none";

  return [
    `time=${s.timeOfDay} (${s.timeOfDay < 13000 ? "day" : "night"})`,
    `me: hp=${s.self.health} food=${s.self.food} holding=${s.self.heldItem ?? "nothing"} state=${s.followState}${looking}`,
    `goal: ${goal}`,
    p
      ? `player ${p.username}: ${p.online ? `${p.distance ?? "?"}b away` : "offline"}`
      : "player: not found",
    `hostiles: ${hostiles}`,
    `inventory: ${inv}`,
    `recent chat: ${chat}`,
  ].join("\n");
}
