/**
 * 物品 / 方块 / 生物的中文名 —— 让牢大眼里的世界说中文。
 *
 * 名字从哪来：**从你本机 Minecraft 的语言文件里读**（`assets/objects` 里那份
 * zh_cn.json，8500+ 条），所以和你在游戏里看到的**逐字一致**：
 * oak_log → 橡木原木、raw_iron → 粗铁、deepslate_iron_ore → 深层铁矿石。
 * 读不到（没装游戏、换机器跑）就退回手写小词典 + 构词法，最差显示原来的英文 id，
 * 绝不会因此崩掉或者显示空白。
 *
 * 物品和生物是**两张表**：Minecraft 里 chicken 这种 id 两边都有
 * （物品=生鸡肉，生物=鸡），混一张表就会串味。
 *
 * 反向也要能用：模型看到的是中文，它调工具时自然会说「橡木原木」，
 * 所以 itemIdFromZh 负责把中文换回 mineflayer 认的 id。
 */
import { FALLBACK_ENTITY_ZH, FALLBACK_ZH, ZH_ALIASES } from "./zh-fallback.js";

/** 语言文件读来的表。没加载时为 null。 */
let itemNames: Map<string, string> | null = null;
let entityNames: Map<string, string> | null = null;
/** 反查表（中文 → id），第一次用到时才建。 */
let reverse: Map<string, string> | null = null;

type Kind = "item" | "block" | "entity" | "plain";
/** 同一个 id 出现在多个命名空间时谁说了算（物品 > 方块，生物单独一张表）。 */
const RANK: Record<Kind, number> = { item: 3, block: 2, entity: 1, plain: 0 };

function parseKey(rawKey: string): { id: string; kind: Kind } | null {
  const m = /^(item|block|entity)\.minecraft\.(.+)$/.exec(rawKey);
  if (m?.[1] && m[2]) return { id: m[2], kind: m[1] as Kind };
  if (/^[a-z0-9_]+$/.test(rawKey)) return { id: rawKey, kind: "plain" };
  return null;
}

/**
 * 灌入语言文件里的一批条目（key 形如 `item.minecraft.oak_log`，也接受裸 id）。
 * 返回收下的总条数。
 */
export function setChineseNames(entries: Record<string, string>): number {
  const items = new Map<string, string>();
  const entities = new Map<string, string>();
  const rank = new Map<string, number>();

  for (const [rawKey, zh] of Object.entries(entries)) {
    if (typeof zh !== "string" || zh.length === 0) continue;
    const parsed = parseKey(rawKey);
    if (!parsed) continue;

    if (parsed.kind === "entity") {
      if (!entities.has(parsed.id)) entities.set(parsed.id, zh);
      continue;
    }
    const prev = rank.get(parsed.id) ?? -1;
    if (RANK[parsed.kind] >= prev) {
      items.set(parsed.id, zh);
      rank.set(parsed.id, RANK[parsed.kind]);
    }
  }

  itemNames = items;
  entityNames = entities;
  reverse = null;
  return items.size + entities.size;
}

export function hasChineseNames(): boolean {
  return (itemNames?.size ?? 0) > 0;
}

export function chineseNameCount(): number {
  return (itemNames?.size ?? 0) + (entityNames?.size ?? 0);
}

/**
 * 构词法用的词表：按 `_` 拆开后**逐词**翻译。
 *
 * 之前试过"前缀 + 后缀"两段式，结果 birch_stairs 翻成「白桦stairs」——
 * 因为词根没翻。逐词表就没这个毛病：白桦 + 楼梯。
 */
const WORD: Record<string, string> = {
  // 木材 / 颜色
  oak: "橡木", birch: "白桦", spruce: "云杉", jungle: "丛林", acacia: "金合欢",
  dark: "深色", mangrove: "红树", cherry: "樱花", bamboo: "竹", crimson: "绯红", warped: "诡异",
  red: "红", white: "白", black: "黑", blue: "蓝", brown: "棕", orange: "橙", yellow: "黄",
  green: "绿", lime: "黄绿", cyan: "青", light: "淡", gray: "灰", pink: "粉", purple: "紫", magenta: "品红",
  // 处理方式
  stripped: "去皮", deepslate: "深层", raw: "粗制", polished: "磨制", chiseled: "雕纹",
  cracked: "裂纹", mossy: "苔藓", smooth: "平滑", waxed: "涂蜡", cut: "切制",
  oxidized: "氧化", weathered: "斑驳", exposed: "斑驳", infested: "虫蚀",
  // 材质
  stone: "石", wooden: "木", iron: "铁", golden: "金", gold: "金", diamond: "钻石",
  netherite: "下界合金", leather: "皮革", chainmail: "锁链", copper: "铜", nether: "下界",
  cobblestone: "圆石", cobbled: "圆石", sand: "沙", sandstone: "砂岩", terracotta: "陶瓦",
  obsidian: "黑曜石", bedrock: "基岩", quartz: "石英", amethyst: "紫水晶", emerald: "绿宝石",
  redstone: "红石", lapis: "青金石", coal: "煤", charcoal: "木炭", clay: "黏土",
  // 形状 / 功能
  log: "原木", wood: "木头", planks: "木板", stairs: "楼梯", slab: "台阶", fence: "栅栏",
  gate: "门", door: "门", trapdoor: "活板门", button: "按钮", pressure: "压力", plate: "板",
  sign: "告示牌", boat: "船", sapling: "树苗", leaves: "树叶", seeds: "种子", seed: "种子",
  ore: "矿石", ingot: "锭", nugget: "粒", block: "块", scrap: "碎片", brick: "砖", bricks: "砖",
  sword: "剑", pickaxe: "镐", axe: "斧", shovel: "锹", hoe: "锄", bow: "弓", arrow: "箭",
  helmet: "头盔", chestplate: "胸甲", leggings: "护腿", boots: "靴子", shield: "盾牌",
  dust: "粉", gem: "宝石", rod: "棒", shard: "碎片", bucket: "桶", pane: "板",
  apple: "苹果", carrot: "胡萝卜", potato: "土豆", bread: "面包", wheat: "小麦", stick: "棍",
  sugar: "糖", cane: "甘蔗", egg: "蛋", milk: "奶", honey: "蜂蜜", bottle: "瓶",
  book: "书", paper: "纸", glass: "玻璃", torch: "火把", lantern: "灯", campfire: "营火",
  crafting: "工作", table: "台", furnace: "熔炉", chest: "箱子", barrel: "木桶",
  ladder: "梯子", dirt: "泥土", grass: "草", gravel: "沙砾", snow: "雪", ice: "冰",
  wool: "羊毛", sponge: "海绵", ancient: "远古", debris: "残骸", elytra: "鞘翅",
  totem: "图腾", undying: "不死", flint: "打火石", steel: "钢",
};

/**
 * 兜底构词：按 `_` 拆开逐词翻。
 *
 * **有一个词不认识就整体返回原 id** —— 宁可显示 `copper_grate`，
 * 也不要显示「铜grate」这种半中半英的东西。
 */
function guessZh(id: string): string {
  const words = id.split("_");
  const parts: string[] = [];
  for (const w of words) {
    const zh = WORD[w];
    if (!zh) return id;
    parts.push(zh);
  }
  return parts.join("");
}

function bare(id: string): string {
  return id.replace(/^minecraft:/, "");
}

/** 物品/方块的中文名（查不到就兜底词典 → 构词法 → 原 id）。 */
export function itemNameZh(id: string): string {
  if (!id) return id;
  const key = bare(id);
  return itemNames?.get(key) ?? FALLBACK_ZH[key] ?? guessZh(key);
}

/** 生物的中文名。查不到时退回物品名（有些实体就叫 item 名），再不行原样。 */
export function entityNameZh(id: string): string {
  if (!id) return id;
  const key = bare(id);
  return entityNames?.get(key) ?? FALLBACK_ENTITY_ZH[key] ?? itemNameZh(key);
}

/** 反查表：中文 → id。简称最后放进去，优先级最高。 */
function reverseMap(): Map<string, string> {
  if (reverse) return reverse;
  const map = new Map<string, string>();
  for (const [id, zh] of Object.entries(FALLBACK_ZH)) if (!map.has(zh)) map.set(zh, id);
  if (itemNames) for (const [id, zh] of itemNames) if (!map.has(zh)) map.set(zh, id);
  if (entityNames) for (const [id, zh] of entityNames) if (!map.has(zh)) map.set(zh, id);
  for (const [zh, id] of Object.entries(ZH_ALIASES)) map.set(zh, id);
  reverse = map;
  return map;
}

/**
 * 把模型（或玩家）说的名字换成 mineflayer 认的 id。
 * 认不出来返回 null —— 调用方保留原文，让游戏那边去报"没有这个东西"。
 */
export function itemIdFromZh(text: string): string | null {
  const t = text.trim();
  if (t.length === 0) return null;
  const plain = bare(t);
  if (/^[a-z0-9_]+$/.test(plain)) return plain; // 本来就是 id
  return reverseMap().get(t) ?? reverseMap().get(plain) ?? null;
}

/**
 * 工具参数归一化：中文名换成 id，已经是 id 的原样返回。
 * 每个"要吃物品名"的接口开头都该过一下这个。
 */
export function toItemId(name: string): string {
  return itemIdFromZh(name) ?? name;
}