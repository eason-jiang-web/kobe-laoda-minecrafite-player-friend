// itto landing content, mapped onto the wideangles editorial structure.
// Patterns ported from the capture; copy + data are itto's own (IP discipline).

export const brand = {
  name: "itto",
  mark: "itto®",
  tagline: "your minecraft duo",
  email: "founders@kalilabs.ai",
  location: "your world",
  year: "2026",
};

export const nav = [
  { label: "clips", href: "#clips" },
  { label: "about", href: "#about" },
  { label: "how it plays", href: "#points" },
  { label: "early access", href: "#cta" },
];

// section 2 — "latest" → itto clips (gameplay moments). Only real clip
// videos live here; placeholder/default thumbnail cards were removed.
export const clips = [
  {
    title: "Sakura Puddle",
    who: "CHERRY GROVE",
    date: "24—05—2026",
    videoSrc: "/video/clip-sakura-puddle.mp4",
  },
  {
    title: "Trail for Two",
    who: "EXPLORATION",
    date: "24—05—2026",
    videoSrc: "/video/clip-two-players-exploring.mp4",
  },
];

// section 3 — about, 4-column data layout
export const about = {
  intro:
    "An AI buddy that spawns next to you, follows you around, helps out, and hangs in your Discord call. Not a coach, not a tutorial — a friend who happens to be good at the game.",
  columns: [
    {
      head: "what it does",
      items: [
        "Follows You",
        "Mines & Builds",
        "Fights Mobs",
        "Carries Loot",
        "Answers Questions",
        "Talks In Your Call",
        "Reads The Chat",
      ],
    },
    {
      head: "how it plays",
      items: [
        "Survival",
        "Creative",
        "Co-op",
        "Speedruns",
        "Just Hanging",
      ],
    },
    {
      head: "runs on",
      items: [
        "Java 1.20.6",
        "Bedrock Soon",
        "Discord Voice",
        "ElevenLabs Realtime",
        "Mineflayer Bot",
        "Your Own Server",
      ],
    },
  ],
};

// section 4 / banner headers
export const banners = {
  primary: ["FOLLOWS YOU", "& HELPS OUT"],
  secondary: ["A DUO THAT", "ACTUALLY PLAYS"],
};

// section 5 — points / manifesto
export const points = {
  manifesto:
    "AN AI THAT JOINS YOUR WORLD AND JUST PLAYS WITH YOU — MINING, BUILDING, FIGHTING, AND TALKING IN YOUR CALL LIKE A FRIEND WHO NEVER LOGS OFF",
  left: {
    head: "the idea",
    body: "Most game AI is a menu. itto is a presence — it shows up next to you, watches what you're doing, and pitches in. It feels less like a tool and more like a second player.",
  },
  right: {
    head: "the loop",
    body: "It sees the world through the bot, decides what's worth doing, and acts — then talks it through in your voice channel. Helpful, chatty, and occasionally chaotic.",
  },
};

// section 7 — clients → works with
export const worksWith = [
  "DISCORD VOICE",
  "MINEFLAYER",
  "ELEVENLABS",
  "JAVA EDITION",
  "MINEHUT",
  "CLAUDE",
  "YOUR FRIENDS",
];

// closing banner wordmark, split like WA·CO®
export const wordmark = ["it", "to"];
