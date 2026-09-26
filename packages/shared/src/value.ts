/**
 * 物品价值评估 —— "这东西现在值不值得我绕路？"
 *
 * 立场（很重要）：
 *   **上限是"值不值得特意去弄"的参考，不是催他囤货的任务清单。**
 *   所以这里的输出永远是"建议 / 可选"，不会出现"你必须去搞 X"。
 *
 * 评分标准（不拍脑袋，按机制推）：
 *   1. **获取难度**：矿石的每区块产出密度、能不能农场化（可再生）、要几步合成。
 *      —— 泥土/圆石要多少有多少（难度 0）；钻石约 1 脉/区块；远古残骸 1~3 个/区块还要烧；
 *      下界合金锭 = 4 碎片 + 4 金锭。
 *   2. **用途广度**：一个东西能解锁多少事。铁能出工具+装备+铁轨+铁砧+桶；
 *      泥土只能盖房种地。用途越窄，越不该为它绕路。
 *   3. **当下情况**：你手上已经有多少、离上限多远、处在主线哪一步。
 *
 * 参考：Minecraft Wiki 的 Rarity 页是**名字颜色**（绿宝石也是 Common），
 * 不能当生存价值用；真正能用的是 Ore / Renewable resource 这些机制页。
 */
import { PER_PLAYER_WANT, RESOURCE_TARGETS, playerCount } from "./needs.js";
import { itemNameZh } from "./zh-names.js";
import type { GameState } from "./types.js";

export type ValueTier = "relic" | "precious" | "useful" | "common" | "bulk" | "chaff";

export const TIER_LABEL: Record<ValueTier, string> = {
  relic: "传家宝级",
  precious: "稀有",
  useful: "实用",
  common: "常见",
  bulk: "建筑材料",
  chaff: "边角料",
};

export interface ItemKnowledge {
  tier: ValueTier;
  /** 0~100：获取难度 × 用途广度。 */
  base: number;
  /** 一句话：这东西拿来干嘛。 */
  use: string;
  /** 每人建议上限（0 = 不设上限，随时要随时有）。 */
  capPerPlayer: number;
}

/**
 * 认识的东西。**往上加条目就行** —— 不认识的会走下面的模式兜底，
 * 所以任何物品都评得出来（只是精度差一点）。
 */
const KNOWN: Array<[RegExp, ItemKnowledge]> = [
  // ── 传家宝级：一个世界就那么点，或者极难获取 ──
  [/^(netherite_ingot|netherite_scrap)$/, { tier: "relic", base: 98, use: "顶级装备的唯一材料，1 锭要 4 碎片 + 4 金锭", capPerPlayer: PER_PLAYER_WANT.netherite }],
  [/^ancient_debris$/, { tier: "relic", base: 96, use: "下界合金的原料，每区块才 1~3 个还得烧", capPerPlayer: PER_PLAYER_WANT.netherite }],
  [/^(elytra|dragon_egg|nether_star|beacon)$/, { tier: "relic", base: 95, use: "一个存档基本只有一个（鞘翅能多拿但要打末影龙）", capPerPlayer: 1 }],
  [/^shulker_shell$/, { tier: "relic", base: 90, use: "潜影盒 = 随身背包，末地城限定", capPerPlayer: 8 }],
  [/^(totem_of_undying|enchanted_golden_apple)$/, { tier: "relic", base: 88, use: "保命道具，死了不掉装备全靠它", capPerPlayer: 3 }],
  // ── 稀有 ──
  [/^(diamond|diamond_(sword|pickaxe|axe|shovel|hoe|helmet|chestplate|leggings|boots))$/, { tier: "precious", base: 85, use: "毕业装备 + 附魔台的核心，约 1 脉/区块", capPerPlayer: PER_PLAYER_WANT.diamond }],
  [/^emerald$/, { tier: "precious", base: 72, use: "村民交易的硬通货（也是 Mending 的货币）", capPerPlayer: 64 }],
  [/^blaze_rod$/, { tier: "precious", base: 82, use: "酿造台 + 末影之眼，只能去下界要塞打烈焰人", capPerPlayer: 12 }],
  [/^(ender_pearl|ender_eye)$/, { tier: "precious", base: 80, use: "找要塞、末影箱、瞬移，末影人掉落", capPerPlayer: 16 }],
  [/^(netherite|diamond)_(helmet|chestplate|leggings|boots)$/, { tier: "precious", base: 84, use: "毕业防具", capPerPlayer: 2 }],
  // ── 实用：日常主力 ──
  [/^(iron_ingot|raw_iron)$/, { tier: "useful", base: 70, use: "工具/装备/铁轨/铁砧/桶 —— 用途最广的材料，一个铁砧就 31", capPerPlayer: PER_PLAYER_WANT.iron }],
  [/^(gold_ingot|raw_gold)$/, { tier: "useful", base: 62, use: "金苹果、动力铁轨、下界合金都要它", capPerPlayer: PER_PLAYER_WANT.gold }],
  [/^lapis_lazuli$/, { tier: "useful", base: 58, use: "附魔必需", capPerPlayer: PER_PLAYER_WANT.lapis }],
  [/^redstone$/, { tier: "useful", base: 55, use: "红石机关 + 药水，成组烧", capPerPlayer: PER_PLAYER_WANT.redstone }],
  [/^(coal|charcoal)$/, { tier: "useful", base: 50, use: "1 煤 = 4 火把 + 燃料", capPerPlayer: PER_PLAYER_WANT.coal }],
  [/^(iron|gold|stone|wooden|diamond|netherite)_(sword|pickaxe|axe|shovel|hoe)$/, { tier: "useful", base: 60, use: "工具/武器，坏了再做", capPerPlayer: 3 }],
  [/^(iron|gold|chainmail|leather)_(helmet|chestplate|leggings|boots)$/, { tier: "useful", base: 58, use: "过渡防具", capPerPlayer: 2 }],
  [/^(bucket|water_bucket|lava_bucket|flint_and_steel|shield|shears|fishing_rod|compass|clock|spyglass)$/, { tier: "useful", base: 56, use: "生存道具", capPerPlayer: 2 }],
  [/^(brewing_stand|cauldron|anvil|enchanting_table|bookshelf|crafting_table|furnace|blast_furnace|smoker|chest|barrel|bed)$/, { tier: "useful", base: 54, use: "工作设施，一个基地一套就够", capPerPlayer: 4 }],
  [/^(bread|cooked_beef|cooked_porkchop|cooked_chicken|cooked_mutton|golden_carrot|apple)$/, { tier: "useful", base: 45, use: "吃的，跑远门靠它", capPerPlayer: PER_PLAYER_WANT.food }],
  [/^(arrow|bow|crossbow|torch|lantern|scaffolding)$/, { tier: "useful", base: 42, use: "消耗品，用得快", capPerPlayer: 64 }],
  // ── 常见 ──
  [/^(_?oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|pale_oak)?_?(log|planks|wood|stem|hyphae)$/, { tier: "common", base: 35, use: "基础建材，砍就有", capPerPlayer: PER_PLAYER_WANT.wood }],
  [/^(stone|cobblestone|deepslate|cobbled_deepslate|stone_bricks)$/, { tier: "common", base: 32, use: "基础建材，挖就有", capPerPlayer: PER_PLAYER_WANT.stone }],
  [/^(glass|sand|sandstone|brick|nether_brick|quartz_block|terracotta|concrete|wool|_?white_wool)$/, { tier: "common", base: 30, use: "装饰建材", capPerPlayer: 128 }],
  [/^(copper_ingot|raw_copper|amethyst_shard|quartz)$/, { tier: "common", base: 34, use: "装饰/避雷针/望远镜", capPerPlayer: 64 }],
  [/^(stick|string|leather|feather|flint|clay_ball|brick|paper|book|bone|bone_meal|gunpowder|slime_ball)$/, { tier: "common", base: 30, use: "合成中间件", capPerPlayer: 64 }],
  [/^(wheat|carrot|potato|beetroot|sugar_cane|seeds|melon_slice|pumpkin)$/, { tier: "common", base: 28, use: "农场产物", capPerPlayer: 64 }],
  // ── 建筑材料：要多少有多少 ──
  [/^(dirt|grass_block|coarse_dirt|podzol|mycelium|gravel|netherrack|end_stone|andesite|diorite|granite|tuff|calcite|basalt|blackstone|magma_block|soul_sand|soul_soil|moss_block)$/, { tier: "bulk", base: 12, use: "填坑铺路用的建材，满地都是", capPerPlayer: 0 }],
  [/^(oak|spruce|birch|jungle|acacia|dark_oak)?_?(leaves|sapling)$/, { tier: "chaff", base: 6, use: "树叶树苗，剪了就有", capPerPlayer: 0 }],
  // ── 边角料 ──
  [/^(rotten_flesh|poisonous_potato|dead_bush|spider_eye|fermented_spider_eye|pufferfish|bone_meal?)$/, { tier: "chaff", base: 8, use: "基本只能喂狗/堆肥/交易", capPerPlayer: 0 }],
];

/** 不认识的物品靠名字猜（总比"不知道"强）。 */
function infer(name: string): ItemKnowledge {
  const n = name;
  if (/_ore$/.test(n)) return { tier: "precious", base: 70, use: "矿石，能挖就顺手挖", capPerPlayer: 32 };
  if (/^raw_/.test(n)) return { tier: "useful", base: 58, use: "未冶炼的原料", capPerPlayer: 32 };
  if (/_ingot$|_nugget$/.test(n)) return { tier: "useful", base: 55, use: "金属材料", capPerPlayer: 64 };
  if (/_log$|_planks$|_wood$/.test(n)) return { tier: "common", base: 32, use: "木料建材", capPerPlayer: PER_PLAYER_WANT.wood };
  if (/_sword$|_pickaxe$|_axe$|_shovel$|_hoe$/.test(n)) return { tier: "useful", base: 50, use: "工具", capPerPlayer: 3 };
  if (/_helmet$|_chestplate$|_leggings$|_boots$/.test(n)) return { tier: "useful", base: 52, use: "防具", capPerPlayer: 2 };
  if (/_bricks?$|_block$/.test(n)) return { tier: "common", base: 28, use: "建材", capPerPlayer: 128 };
  if (/_seeds$|_sapling$/.test(n)) return { tier: "chaff", base: 8, use: "种地用的", capPerPlayer: 0 };
  return { tier: "common", base: 30, use: "我不太确定这东西值多少", capPerPlayer: 64 };
}

export function itemKnowledge(name: string): ItemKnowledge {
  for (const [rx, k] of KNOWN) if (rx.test(name)) return k;
  return infer(name);
}

/** 上限覆盖表：组名（"iron"）或具体物品名（"raw_iron"）→ 绝对总数。 */
export type CapOverrides = Record<string, number>;

/** 这个物品属于哪个需求组（raw_iron → iron）。不在表里的返回 null。 */
export function resourceIdFor(name: string): string | null {
  return RESOURCE_TARGETS.find((t) => t.match(name))?.id ?? null;
}

function capFor(name: string, state: GameState): { cap: number; custom: boolean } {
  const overrides: CapOverrides = state.valueCaps ?? {};
  const group = resourceIdFor(name);
  const custom = (group !== null ? overrides[group] : undefined) ?? overrides[name];
  if (custom !== undefined) return { cap: custom, custom: true };

  const knowledge = itemKnowledge(name);
  const people = playerCount(state);
  return { cap: knowledge.capPerPlayer > 0 ? knowledge.capPerPlayer * people : 0, custom: false };
}

export type ValueVerdict = "unlimited" | "worth" | "optional" | "enough" | "overflow";

export interface ItemVerdict {
  name: string;
  count: number;
  knowledge: ItemKnowledge;
  /** 当下情况下的价值分（0~100），已经算上"你已经有几个了"。 */
  score: number;
  cap: number;
  /** 上限是玩家自己用 #value 定的（不是默认表）。 */
  customCap: boolean;
  verdict: ValueVerdict;
  /** 一句话建议 —— **永远只是建议**。 */
  advice: string;
}

/**
 * 评估**一件**物品在**当下**值不值得。注意 score 会随持有量衰减：
 * 已经到上限的东西，价值分会被压到 30% —— 因为"再去弄它"已经没意义了。
 */
export function evaluateItem(name: string, count: number, state: GameState): ItemVerdict {
  const knowledge = itemKnowledge(name);
  const { cap, custom } = capFor(name, state);

  let verdict: ValueVerdict;
  let factor = 1;
  if (cap === 0) {
    verdict = "unlimited";
  } else if (count >= cap * 1.25) {
    verdict = "overflow";
    factor = 0.3;
  } else if (count >= cap) {
    verdict = "enough";
    factor = 0.6;
  } else if (count >= cap * 0.5 || knowledge.base >= 80) {
    verdict = "worth";
  } else {
    verdict = "optional";
  }

  const score = Math.round(knowledge.base * factor);
  const advice =
    verdict === "unlimited"
      ? "要多少有多少，别为它绕路"
      : verdict === "overflow"
        ? "早就溢出了（" + count + "/" + cap + "），纯占地方"
        : verdict === "enough"
          ? "够了（" + count + "/" + cap + "），不用特意去弄"
          : verdict === "worth"
            ? "值得顺手拿（" + count + "/" + cap + "）"
            : "有就拿，没有也不用找（" + count + "/" + cap + "）";

  return { name, count, knowledge, score, cap, customCap: custom, verdict, advice };
}

/** 组名 → 一个代表性物品（用来查"这东西干嘛用的"）。 */
const GROUP_EXAMPLE: Record<string, string> = {
  iron: "iron_ingot",
  gold: "gold_ingot",
  diamond: "diamond",
  netherite: "netherite_ingot",
  wood: "oak_log",
  stone: "stone",
  coal: "coal",
  redstone: "redstone",
  lapis: "lapis_lazuli",
  food: "bread",
};

export function representativeItem(key: string): string {
  return GROUP_EXAMPLE[key] ?? key;
}

/** 背包里属于这个组（或这个具体物品）的总数。 */
export function countFor(key: string, state: GameState): number {
  const group = RESOURCE_TARGETS.find((t) => t.id === key);
  return state.inventory
    .filter((i) => (group ? group.match(i.name) : i.name === key))
    .reduce((n, i) => n + i.count, 0);
}

/** 组名 → 中文标签（铁 / 钻石 / 下界合金…）。 */
export function groupLabel(key: string): string {
  return RESOURCE_TARGETS.find((t) => t.id === key)?.label ?? key;
}

/**
 * 单件详情：#value 钻石 打出来的那种（一行，含自定义标记）。
 * `label` 用中文标签覆盖显示名（组名查出来的是代表物品，比如 iron_ingot）。
 */
export function itemDetail(name: string, count: number, state: GameState, label?: string): string {
  const v = evaluateItem(name, count, state);
  const capText = v.cap === 0 ? "不限量" : v.cap + (v.customCap ? "（你自己定的）" : "");
  return (
    (label ?? itemNameZh(v.name)) +
    "：" +
    TIER_LABEL[v.knowledge.tier] +
    "·" +
    v.score +
    " 分｜用途：" +
    v.knowledge.use +
    "｜你有 " + count + "，上限 " + capText + " → " + v.advice
  );
}

/** 一行版：游戏聊天有长度限制，别超 200 字。 */
export function valueOneLiner(state: GameState): string {
  const all = evaluateInventory(state);
  const worth = all
    .filter((v) => v.verdict === "worth")
    .slice(0, 3)
    .map((v) => itemNameZh(v.name) + "×" + v.count);
  const over = all
    .filter((v) => v.verdict === "overflow")
    .slice(0, 3)
    .map((v) => itemNameZh(v.name) + "×" + v.count);
  const bits: string[] = [];
  if (worth.length > 0) bits.push("值钱：" + worth.join("、"));
  if (over.length > 0) bits.push("溢出：" + over.join("、"));
  return (bits.length > 0 ? bits.join("；") : "没什么特别的") + "（上限只是参考，不催你）";
}

/** 背包里每样东西都评一遍，按当下价值从高到低。 */
export function evaluateInventory(state: GameState): ItemVerdict[] {
  return state.inventory
    .map((slot) => evaluateItem(slot.name, slot.count, state))
    .sort((a, b) => b.score - a.score || b.count - a.count);
}

/**
 * 给提示词/命令用的一段话。**语气是"参考"，不是"任务"** ——
 * 这是 eason 特意要求的：不要催。
 */
export function valueReport(state: GameState, limit = 6): string {
  const all = evaluateInventory(state);
  if (all.length === 0) return "背包是空的，没什么可评估的";

  const people = playerCount(state);
  const worth = all.filter((v) => v.verdict === "worth").slice(0, limit);
  const overflow = all.filter((v) => v.verdict === "overflow").slice(0, limit);
  const lines: string[] = [];

  if (worth.length > 0) {
    lines.push(
      "当下还算值钱：" +
        worth.map((v) => itemNameZh(v.name) + "×" + v.count + "（" + v.knowledge.use + "）").join("、"),
    );
  }
  if (overflow.length > 0) {
    lines.push(
      "已经溢出的（别为它们绕路、也别催他囤）：" +
        overflow.map((v) => itemNameZh(v.name) + "×" + v.count).join("、"),
    );
  }
  if (lines.length === 0) lines.push("没有特别值钱也没溢出，正常玩就行");
  lines.push(
    "（上限只是「值不值得特意去弄」的参考，不是任务清单；按 " + people + " 人算。他不想弄就别提。）",
  );
  return lines.join("\n");
}
