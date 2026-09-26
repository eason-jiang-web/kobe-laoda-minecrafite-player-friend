/**
 * "能不能挖" 和 "还缺不缺" —— 让攻略有弹性的两块判断。
 *
 * 为什么放在 shared：身体要用（看到矿就地判断）、大脑也要用（决定值不值得绕路）。
 * 全是纯函数，好测。
 *
 * 设计立场：**攻略里的数字是区间不是死线**。这里的 want 是"差不多够用"，
 * 不是"必须精确到个位"；have 远超 want 就是 surplus，该劝它别挖了。
 */
import type { GameState, InventoryItem } from "./types.js";

// ── 镐子等级 ─────────────────────────────────────────────────────────────

const PICKAXE_TIERS: Array<[RegExp, number]> = [
  [/^netherite_pickaxe$/, 5],
  [/^diamond_pickaxe$/, 4],
  [/^iron_pickaxe$/, 3],
  [/^stone_pickaxe$/, 2],
  [/^(wooden|golden)_pickaxe$/, 1],
];

const TIER_NAMES = ["徒手", "木/金镐", "石镐", "铁镐", "钻石镐", "下界合金镐"];

export function tierName(tier: number): string {
  return TIER_NAMES[Math.max(0, Math.min(TIER_NAMES.length - 1, tier))] ?? "徒手";
}

/** 背包里最好那把镐子的等级（0 = 没镐子）。 */
export function pickaxeTier(inv: InventoryItem[]): number {
  let best = 0;
  for (const item of inv) {
    for (const [rx, tier] of PICKAXE_TIERS) {
      if (rx.test(item.name) && tier > best) best = tier;
    }
  }
  return best;
}

const BLOCK_TIERS: Array<[RegExp, number]> = [
  [/^(ancient_debris|obsidian|crying_obsidian|respawn_anchor)$/, 4],
  [
    /^(diamond_ore|deepslate_diamond_ore|emerald_ore|deepslate_emerald_ore|gold_ore|deepslate_gold_ore|nether_gold_ore|redstone_ore|deepslate_redstone_ore)$/,
    3,
  ],
  [
    /^(iron_ore|deepslate_iron_ore|copper_ore|deepslate_copper_ore|lapis_ore|deepslate_lapis_ore)$/,
    2,
  ],
  [/^(coal_ore|deepslate_coal_ore|nether_quartz_ore)$/, 1],
];

/** 这块矿要几级镐子（null = 不在表里 / 不是镐子挖的）。 */
export function requiredTier(blockName: string): number | null {
  const name = blockName.toLowerCase();
  for (const [rx, tier] of BLOCK_TIERS) if (rx.test(name)) return tier;
  return null;
}

export interface MineVerdict {
  can: boolean;
  required: number;
  have: number;
  /** 不能挖时给模型看的原因。 */
  why?: string;
}

export function canMine(inv: InventoryItem[], blockName: string): MineVerdict {
  const required = requiredTier(blockName);
  const have = pickaxeTier(inv);
  if (required === null) return { can: true, required: 0, have };
  if (have >= required) return { can: true, required, have };
  return {
    can: false,
    required,
    have,
    why: `挖不动：${blockName} 需要${tierName(required)}，你手上最好的是${tierName(have)}`,
  };
}

// ── 值不值得挖 / 还缺不缺 ────────────────────────────────────────────────

/** 值钱的矿（用来决定"路过要不要停一下"）。数字越大越值钱。 */
const ORE_VALUE: Array<[RegExp, number]> = [
  [/^(ancient_debris)$/, 10],
  [/^(deepslate_)?(diamond_ore|emerald_ore)$/, 9],
  [/^(deepslate_)?gold_ore$|^nether_gold_ore$/, 6],
  [/^(deepslate_)?redstone_ore$/, 4],
  [/^(deepslate_)?lapis_ore$/, 4],
  [/^nether_quartz_ore$/, 3],
  [/^(deepslate_)?iron_ore$/, 3],
  [/^(deepslate_)?copper_ore$/, 2],
  [/^(deepslate_)?coal_ore$/, 2],
];

export function oreValue(blockName: string): number {
  const name = blockName.toLowerCase();
  for (const [rx, value] of ORE_VALUE) if (rx.test(name)) return value;
  return 0;
}

export function isValuableOre(blockName: string): boolean {
  return oreValue(blockName) >= 3;
}

export interface ResourceTarget {
  id: string;
  label: string;
  match(name: string): boolean;
  /** **每人**"差不多够用"的量。实际目标 = 这个 × 在线人数。 */
  wantPerPlayer: number;
}

/**
 * 每人份的"够了"标准。人数按**在线玩家**算（见 GameState.players）——
 * 两个人一起玩，目标就是双份；超过 1.25 倍才算"囤过头"。
 *
 * 定这些数的思路：**按"实际要花多少"倒推，而不是拍脑袋**。
 * 目标是"再囤就没意义了"的那条线，不是"攒得很爽"的量。
 * 想改就改这里（一处生效；别在 shared 里读 process.env —— 这个包也会进网页端）。
 */
export const PER_PLAYER_WANT = {
  /** 木头：工具 + 箱子 + 盖个小屋，两组差不多；再砍就是纯囤。 */
  wood: 128,
  /** 石头：盖房主力材料，两组打底。 */
  stone: 128,
  /** 煤：1 煤 = 4 火把，64 煤 = 256 根，够把矿洞点成白天。 */
  coal: 64,
  /** 铁：一套铁装备 24，**一个铁砧就 31**，再加上桶/剪刀/打火石/铁轨 —— 100 是真的会用完。 */
  iron: 100,
  /** 金：金苹果 8 锭一个，动力铁轨 6 锭 16 根，下界合金每锭还要 4 金。64 够折腾了。 */
  gold: 64,
  /** 钻石：整套装备 24 + 全工具 9 + 附魔台 2 ≈ 40，留一套重造的余量 → 64。 */
  diamond: 64,
  /** 下界合金：1 锭 = 4 碎片；全身 4 件 + 3 工具 = 7 锭 = 28 碎片 ≈ 14 个残骸。32 已经很肝了。 */
  netherite: 32,
  /** 红石：机关和药水都是成组烧的。 */
  redstone: 64,
  /** 青金石：附魔一次 1~3 个，32 够用很久。 */
  lapis: 32,
  /** 吃的：跑一趟远门就消耗不少，备一组半。 */
  food: 32,
} as const;

/** 这个存档里有几个人（至少 1）。 */
export function playerCount(state: GameState): number {
  return Math.max(1, state.players?.length ?? 0);
}

const STONEY = /^(stone|cobblestone|deepslate|cobbled_deepslate|andesite|diorite|granite|tuff|blackstone)$/;

export const RESOURCE_TARGETS: ResourceTarget[] = [
  { id: "wood", label: "木头", match: (n) => /(_log|_wood|_stem|_hyphae)$/.test(n), wantPerPlayer: PER_PLAYER_WANT.wood },
  { id: "stone", label: "石头", match: (n) => STONEY.test(n), wantPerPlayer: PER_PLAYER_WANT.stone },
  { id: "coal", label: "煤/木炭", match: (n) => n === "coal" || n === "charcoal", wantPerPlayer: PER_PLAYER_WANT.coal },
  { id: "iron", label: "铁", match: (n) => n === "raw_iron" || n === "iron_ingot", wantPerPlayer: PER_PLAYER_WANT.iron },
  { id: "gold", label: "金", match: (n) => n === "raw_gold" || n === "gold_ingot", wantPerPlayer: PER_PLAYER_WANT.gold },
  { id: "diamond", label: "钻石", match: (n) => n === "diamond", wantPerPlayer: PER_PLAYER_WANT.diamond },
  {
    id: "netherite",
    label: "下界合金",
    match: (n) => n === "netherite_ingot" || n === "netherite_scrap" || n === "ancient_debris",
    wantPerPlayer: PER_PLAYER_WANT.netherite,
  },
  { id: "redstone", label: "红石", match: (n) => n === "redstone", wantPerPlayer: PER_PLAYER_WANT.redstone },
  { id: "lapis", label: "青金石", match: (n) => n === "lapis_lazuli", wantPerPlayer: PER_PLAYER_WANT.lapis },
  { id: "food", label: "吃的", match: (n) => /(raw_|cooked_)?(beef|porkchop|chicken|mutton|bread|apple|potato|carrot)/.test(n), wantPerPlayer: PER_PLAYER_WANT.food },
];

export interface NeedLine extends ResourceTarget {
  have: number;
  /** 实际目标 = wantPerPlayer × 在线人数。 */
  want: number;
  /** have >= want * 1.25 —— 明显囤过头了。 */
  surplus: boolean;
  needed: boolean;
}

export function assessNeeds(state: GameState): NeedLine[] {
  const people = playerCount(state);
  return RESOURCE_TARGETS.map((target) => {
    const want = target.wantPerPlayer * people;
    const have = state.inventory
      .filter((i) => target.match(i.name))
      .reduce((n, i) => n + i.count, 0);
    return {
      ...target,
      want,
      have,
      needed: have < want,
      surplus: have >= want * 1.25,
    };
  });
}

/** 这块矿对应的需求（用来判断"你铁都 400 个了还挖啥"）。 */
export function needForOre(state: GameState, blockName: string): NeedLine | null {
  const bare = blockName.replace(/^deepslate_/, "").replace(/_ore$/, "");
  const lines = assessNeeds(state);
  const aliases: Record<string, string> = {
    iron: "iron",
    gold: "gold",
    diamond: "diamond",
    redstone: "redstone",
    lapis: "lapis",
    coal: "coal",
    copper: "stone",
    emerald: "diamond",
    quartz: "stone",
    ancient_debris: "netherite",
    netherite_scrap: "netherite",
  };
  const id = aliases[bare];
  return id ? (lines.find((l) => l.id === id) ?? null) : null;
}

/**
 * 一行盘点："还缺什么 / 早就够了"。
 * 游戏里的 `#value`（不带参数）把它和值钱总览拼在一起说 —— 合起来 150 字左右，
 * 在聊天栏 256 的上限里，所以不拆行。
 */
export function needsSummary(state: GameState): string {
  const people = playerCount(state);
  const lines = assessNeeds(state);
  const lack = lines.filter((l) => l.needed).map((l) => `${l.label} ${l.have}/${l.want}`);
  const enough = lines.filter((l) => l.surplus).map((l) => `${l.label} ${l.have}`);
  const bits: string[] = [];
  if (lack.length > 0) bits.push("还缺：" + lack.join("、"));
  if (enough.length > 0) bits.push("早就够了（别再囤）：" + enough.join("、"));
  const who = people > 1 ? `（按 ${people} 人算）` : "";
  return (bits.length > 0 ? bits.join("；") : "物资都还行") + who;
}
