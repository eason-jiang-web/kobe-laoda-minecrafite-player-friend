// itto landing content, mapped onto the wideangles editorial structure.
// Patterns ported from the capture; copy + data are itto's own (IP discipline).

export const brand = {
  name: "itto",
  mark: "itto®",
  tagline: "ai minecraft co-op buddy",
  email: "founders@kalilabs.ai",
  location: "your world",
  year: "2026",
};

export const nav = [
  { label: "loops", href: "#clips" },
  { label: "about", href: "#about" },
  { label: "how it works", href: "#points" },
  { label: "early access", href: "#cta" },
];

// section 2 — "latest" → itto loops. Only real clip videos live here;
// placeholder/default thumbnail cards were removed.
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
    "itto joins your Minecraft world, follows you around, helps with tasks, and hangs in your Discord call. Not a coach. Not a tutorial bot. A duo partner.",
  body: [
    "The point is presence. itto should feel like another player who notices the little things: when you start mining, when your inventory fills up, when night falls, when a mob wanders too close, when you are clearly building something and could use an extra pair of hands.",
    "Under the hood it runs two loops. A fast loop handles the obvious Minecraft reflexes, like staying nearby, avoiding danger, and reacting to what changed. A slower agent loop reads the world state, remembers useful details, chooses goals, and talks through what it is doing in Discord.",
    "The long-term version is not a menu of commands. It is a friend-shaped system for co-op worlds: useful enough to matter, quiet enough to not take over, and weirdly alive when it starts making small decisions beside you.",
  ],
  stats: [
    { value: "24/7", label: "world presence" },
    { value: "2 loops", label: "reflex + planning" },
    { value: "voice", label: "discord native" },
  ],
  columns: [
    {
      head: "what it does",
      items: [
        "Spawns Next To You",
        "Follows Nearby",
        "Mines Alongside",
        "Places Blocks",
        "Fights Mobs",
        "Fetches Items",
        "Scouts Ahead",
        "Talks In Discord",
      ],
    },
    {
      head: "how it works",
      items: [
        "Fast Loop Reflexes",
        "Slow Loop Decisions",
        "Structured Game State",
        "MCP Tool Calls",
        "World Memory",
        "Seeded Skills",
      ],
    },
    {
      head: "runs on",
      items: [
        "Mineflayer",
        "MCP Server",
        "Hermes Agent",
        "Claude",
        "Discord Voice",
        "Java 1.20.6",
      ],
    },
  ],
};

// section 4 / banner headers
export const banners = {
  primary: ["JOINS YOUR WORLD", "& STICKS CLOSE"],
  secondary: ["A DUO PARTNER", "WITH ACTUAL HANDS"],
};

// section 5 — points / manifesto
export const points = {
  manifesto:
    "AN AI MINECRAFT DUO PARTNER THAT FOLLOWS, HELPS, TALKS, AND LEARNS YOUR WORLD WITHOUT TURNING THE GAME INTO A TUTORIAL",
  left: {
    head: "the body",
    body: "A Mineflayer bot runs the fast loop: follow, stay alive, dodge lava, eat, and keep close without waiting on a model. That is what makes itto feel present.",
  },
  right: {
    head: "the brain",
    body: "Hermes and Claude run the slow loop over compact game state. They read MCP resources, call tools, remember your world, and talk only when it matters.",
  },
};

// section 7 — clients → works with
export const worksWith = [
  "MINEFLAYER",
  "MCP TOOLS",
  "HERMES AGENT",
  "CLAUDE",
  "DISCORD VOICE",
  "STRUCTURED STATE",
  "WORLD MEMORY",
  "JAVA EDITION",
];

// closing banner wordmark, split like WA·CO®
export const wordmark = ["it", "to"];
