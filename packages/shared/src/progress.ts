/**
 * 进度 + 工程评估：他"该干什么"、"能盖什么"。
 *
 * 为什么要有它：自主玩原来只会说一句"自己找点事干" —— 模型不知道你走到哪一步、
 * 也不知道材料够不够盖个农场或刷怪塔，于是要么原地转圈，要么说些不痛不痒的话。
 * 这里把两件事算清楚，写成一段话喂给大脑：
 *   ① 主线进度（复用 guide 的 STAGES 判断）
 *   ② 各类设施的**开工条件**：够了就是"可以做"，不够就列"还差什么"
 *
 * 判断只看它自己的背包 + 维度（和 STAGES 一样）—— 背包不等于全部家当，
 * 所以措辞永远留余地；而且**只建议、不催**（这是 eason 定的调子）。
 */
import { guideProgress, STAGES } from "./guide.js";
import type { GameState } from "./types.js";

/** 一条开工条件：背包里某类东西够不够。 */
interface Need {
  /** 中文名，直接念给人听。 */
  label: string;
  want: number;
  /** 现在有多少（自己数，认多种 id）。 */
  have(state: GameState): number;
}

export interface Facility {
  id: string;
  name: string;
  /** 为什么值得盖（一句话）。 */
  why: string;
  /** 材料齐了吗。 */
  ready: boolean;
  /** 还差什么，比如 ["圆石 ×40", "火把 ×8"]。 */
  missing: string[];
  /** 怎么起手（给大脑的行动提示）。 */
  hint: string;
}

function total(state: GameState, match: (name: string) => boolean): number {
  return state.inventory.filter((slot) => match(slot.name)).reduce((sum, slot) => sum + slot.count, 0);
}

const any = (...names: string[]) => (s: GameState) => total(s, (n) => names.includes(n));
const like = (re: RegExp) => (s: GameState) => total(s, (n) => re.test(n));

/**
 * 设施表。条件是"最低能开工"的线，不是"盖完"的量 —— 盖多大、盖多好由现场决定。
 * 顺序按"早期就能做"排，方便大脑从前往后挑。
 */
const FACILITIES: Array<{
  id: string;
  name: string;
  why: string;
  hint: string;
  needs: Need[];
  /** 背包里看不见、但同样必须有的东西（比如村民）—— 有它就不算"差一点"。 */
  remote?: string;
}> = [
  {
    id: "wheat_farm",
    name: "小麦农场",
    why: "食物能自给，不用天天打猎；小麦还能引牛养动物、做面包和蛋糕。",
    hint: "找块平地，用锄头翻土、种子种下；旁边留一格水（一桶水浇下去就行）。",
    needs: [
      { label: "锄头", want: 1, have: like(/_hoe$/) },
      { label: "种子", want: 3, have: like(/_seeds$/) },
      { label: "泥土/草方块", want: 8, have: like(/^(dirt|grass_block|coarse_dirt|rooted_dirt)$/) },
    ],
  },
  {
    id: "storage_base",
    name: "基地储物间",
    why: "东西有地方放，找东西不用翻背包；熔炉成排烧矿快得多。",
    hint: "拿圆石围一间小屋，摆箱子分类、熔炉靠墙一排，顶上插火把。",
    needs: [
      { label: "箱子", want: 2, have: any("chest", "barrel", "trapped_chest") },
      { label: "熔炉", want: 2, have: any("furnace", "blast_furnace", "smoker") },
      { label: "圆石", want: 32, have: like(/^(cobblestone|stone|cobbled_deepslate)$/) },
      { label: "火把", want: 4, have: any("torch", "lantern", "soul_torch") },
    ],
  },
  {
    id: "animal_pen",
    name: "动物圈养",
    why: "牛肉/羊毛/皮革/鸡蛋能稳定供应，比到处找动物省事。",
    hint: "拿小麦把牛或羊引进围栏（栅栏 + 栅栏门），顺手放个干草堆。",
    needs: [
      { label: "小麦", want: 3, have: any("wheat") },
      { label: "栅栏", want: 6, have: like(/_fence$/) },
      { label: "栅栏门", want: 1, have: like(/_fence_gate$/) },
    ],
  },
  {
    id: "sugar_farm",
    name: "甘蔗 / 竹子农场",
    why: "纸能做书和地图，竹子做脚手架和木棍 —— 都是常用耗材。",
    hint: "沿着水边种甘蔗（沙子和泥土都行），或者在泥地上种竹子。",
    needs: [
      { label: "甘蔗或竹子", want: 1, have: any("sugar_cane", "bamboo") },
      { label: "沙子/泥土", want: 4, have: like(/^(sand|dirt|grass_block)$/) },
      { label: "水桶", want: 1, have: any("water_bucket") },
    ],
  },
  {
    id: "mob_tower",
    name: "刷怪塔",
    why: "经验和掉落（骨头、线、腐肉、铁）都能自动来，比满地追怪舒服。",
    hint: "找一片平地或海面，垒一个高塔留暗层，靠水流把怪冲到中间摔死；开工前先把周围点亮。",
    needs: [
      { label: "圆石/石头", want: 64, have: like(/^(cobblestone|stone|cobbled_deepslate|deepslate)$/) },
      { label: "火把", want: 8, have: any("torch", "lantern") },
      { label: "武器", want: 1, have: like(/(_sword|_axe)$|^bow$/) },
    ],
  },
  {
    id: "portal",
    name: "下界传送门",
    why: "下界是资源宝库（石英、烈焰棒、远古残骸），而且赶路 1 格顶主世界 8 格。",
    hint: "用水浇岩浆做黑曜石（10 个），摆成 4×5 的门框，打火石点着。",
    needs: [
      { label: "黑曜石", want: 10, have: any("obsidian") },
      { label: "打火石", want: 1, have: any("flint_and_steel") },
    ],
  },
  {
    id: "enchant_table",
    name: "附魔台",
    why: "附魔是后期战力的大头，早做早享受；书架越多等级越高。",
    hint: "钻石 2 个 + 黑曜石 4 个做附魔台，再围一圈书架（书要甘蔗做纸 + 皮革）。",
    needs: [
      { label: "钻石", want: 2, have: any("diamond") },
      { label: "黑曜石", want: 4, have: any("obsidian") },
      { label: "书", want: 1, have: any("book", "bookshelf") },
    ],
  },
  {
    id: "iron_farm",
    remote: "两个村民（得先去村庄，或用矿车运回来）",
    name: "铁傀儡农场",
    why: "铁自动来，从此镐子、铁轨、漏斗都不心疼 —— 后期最值钱的一台机器。",
    hint: "需要村民（先去村庄，或者用矿车把两个村民运回来），再备 3 铁块 + 4 铁锭。",
    needs: [
      { label: "铁块", want: 3, have: any("iron_block") },
      { label: "铁锭", want: 4, have: any("iron_ingot") },
    ],
  },
];

/** 挨个算：材料齐 = 现在就能开工；不齐就列出还差多少。 */
export function assessFacilities(state: GameState): (Facility & { remote?: string })[] {
  return FACILITIES.map((f) => {
    const missing: string[] = [];
    for (const need of f.needs) {
      let have = 0;
      try {
        have = need.have(state);
      } catch {
        have = 0;
      }
      if (have < need.want) missing.push(need.label + " ×" + (need.want - have));
    }
    return {
      id: f.id,
      name: f.name,
      why: f.why,
      ready: missing.length === 0,
      missing,
      hint: f.hint,
      remote: f.remote,
    };
  });
}

/** 现在就能开工的（材料齐的）。 */
export function readyFacilities(state: GameState): Facility[] {
  return assessFacilities(state).filter((f) => f.ready);
}

/**
 * 一段"你走到哪儿了 + 现在能盖什么"的说明，喂给大脑。
 *
 * 语气是**建议**：能盖不代表要他盖，缺料也不代表要去凑。
 */
export function progressBriefing(state: GameState, maxMissing = 3): string {
  const { stage, next, index, doneCount } = guideProgress(state);
  const lines: string[] = [];

  lines.push(
    "【进度】主线 " + doneCount + "/" + STAGES.length + "，现在卡在第 " + (index + 1) + " 步「" + stage.title + "」：" + stage.hint,
  );
  if (next) lines.push("下一步是「" + next.title + "」，但不着急。");

  const all = assessFacilities(state);
  const ready = all.filter((f) => f.ready);
  // "差一点"= 只差一件材料，而且不需要背包里看不见的东西（村民那种）。
  // 不然空手开局就会显示"铁傀儡农场：还差铁块、铁锭"，很容易误导。
  const soon = all
    .filter((f) => !f.ready && f.missing.length <= 1 && !f.remote)
    .slice(0, maxMissing);

  if (ready.length > 0) {
    lines.push("【现在就能开工的工程】");
    for (const f of ready.slice(0, 4)) lines.push("- " + f.name + "：" + f.why + "（" + f.hint + "）");
  }
  if (soon.length > 0) {
    lines.push("【差一点就能开工的】");
    for (const f of soon) lines.push("- " + f.name + "：还差 " + f.missing.join("、"));
  }
  if (ready.length === 0 && soon.length === 0) {
    lines.push("【工程】暂时没什么够料开工的项目，先跟着主线走就行。");
  }

  lines.push(
    "工程和进度都只是**建议**：他想盖就搭把手（build_helper 按坐标摆方块，材料不够会如实说），" +
      "他不想弄、正忙着打仗或赶路，就别提。缺料也别说成「任务」——顺手攒着就行。",
  );
  return lines.join("\n");
}
