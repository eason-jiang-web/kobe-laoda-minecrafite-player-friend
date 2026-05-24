import type { GameState } from "@itto/shared";
import type { WorldMemory } from "../memory/store.js";

/**
 * A trigger is a cheap predicate over game state that decides "is anything
 * here worth waking Claude for?" The slow loop runs these every tick. We keep
 * itto mostly quiet (CONTEXT.md anti-pattern: don't be proactively chatty),
 * so triggers should be conservative and rate-limited by the loop.
 */
export interface Trigger {
  name: string;
  /** Return a short reason string if it should fire, else null. */
  check(state: GameState, prev: GameState | null): string | null;
}

/** A trigger that also needs world memory (kept separate so pure triggers stay pure). */
export interface MemoryTrigger {
  name: string;
  check(state: GameState, prev: GameState | null, memory: WorldMemory): string | null;
}

const POINT_PHRASES = ["look at this", "what do you think", "check this out", "see this", "look"];

export const TRIGGERS: Trigger[] = [
  {
    name: "player_addressed_bot",
    check: (s) => {
      const last = s.recentChat.at(-1);
      if (!last || last.username === "itto") return null;
      const lower = last.message.toLowerCase();
      if (POINT_PHRASES.some((p) => lower.includes(p)) || lower.includes("itto"))
        return `player said: "${last.message}"`;
      return null;
    },
  },
  {
    name: "incoming_threat",
    check: (s, prev) => {
      const close = s.nearbyHostiles.find((h) => h.distance < 10);
      if (!close) return null;
      // only fire on NEW threats so we don't nag every tick
      const wasClose = prev?.nearbyHostiles.some((h) => h.id === close.id);
      return wasClose ? null : `${close.name} approaching (${close.distance}b)`;
    },
  },
  {
    name: "player_in_danger",
    check: (s) => {
      // we can't see the player's health, but proximity of mobs to them +
      // night is a decent proxy. Placeholder heuristic.
      if (s.player?.distance != null && s.player.distance < 8 && s.nearbyHostiles.length >= 2)
        return "multiple mobs near the player";
      return null;
    },
  },
  {
    name: "self_low_health",
    check: (s, prev) => {
      if (s.self.health <= 6 && (prev?.self.health ?? 20) > 6) return "bot health critical";
      return null;
    },
  },
  {
    name: "inventory_full",
    check: (s, prev) => {
      // heuristic: ~36 inventory slots; fire once when we cross near-full.
      const full = s.inventory.length >= 35;
      const wasFull = (prev?.inventory.length ?? 0) >= 35;
      return full && !wasFull ? "inventory's basically full" : null;
    },
  },
  {
    name: "tool_broke",
    check: (s, prev) => {
      const d = s.self.heldDurability;
      if (!d) return null;
      const ratio = d.current / d.max;
      const pd = prev?.self.heldDurability;
      const pratio = pd ? pd.current / pd.max : 1;
      if (ratio < 0.1 && pratio >= 0.1) return `${s.self.heldItem} is about to break`;
      return null;
    },
  },
  {
    name: "night_falling",
    check: (s, prev) => {
      if (prev == null) return null;
      if (prev.timeOfDay < 12000 && s.timeOfDay >= 12000) return "getting dark out";
      return null;
    },
  },
];

/** How long to wait before re-announcing a new area (avoids spamming while exploring). */
let lastNewAreaFire = 0;

export const MEMORY_TRIGGERS: MemoryTrigger[] = [
  {
    name: "reached_new_area",
    check: (s, _prev, memory) => {
      if (Date.now() - lastNewAreaFire < 300_000) return null;
      const wps = memory.recallLocations({ limit: 100 });
      if (wps.length === 0) return null;
      const here = s.self.pos;
      const nearest = Math.min(
        ...wps.map((w) => Math.hypot(here.x - w.pos.x, here.y - w.pos.y, here.z - w.pos.z)),
      );
      if (nearest > 200) {
        lastNewAreaFire = Date.now();
        return "we're somewhere new, far from anywhere itto knows";
      }
      return null;
    },
  },
];

/**
 * Periodic "vibe check" — every ~60s consider commenting on the scenery.
 * Stateful so it's separate from the predicate triggers above.
 */
export class VibeCheck {
  private lastAt = Date.now();
  constructor(private readonly intervalMs = 60_000) {}
  due(): boolean {
    if (Date.now() - this.lastAt < this.intervalMs) return false;
    this.lastAt = Date.now();
    return true;
  }
}
