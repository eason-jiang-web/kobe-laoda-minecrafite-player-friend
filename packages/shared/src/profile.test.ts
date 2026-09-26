import { describe, expect, test } from "bun:test";
import {
  HABIT,
  habitLine,
  proficiency,
  profileBrief,
  profileDigest,
  recentLessons,
  skillLine,
  summarizeHabits,
  type AdaptCount,
  type HabitCount,
  type Lesson,
} from "./profile.js";

const h = (key: string, n: number): HabitCount => ({ key, n, updatedAt: 0 });
const a = (area: string, attempts: number, successes: number): AdaptCount => ({
  area,
  attempts,
  successes,
  updatedAt: 0,
});
const l = (area: string, text: string, at: number): Lesson => ({ area, text, at });

describe("proficiency —— 样本少的时候别吹", () => {
  test("没干过是中性 5 分，不是 0 也不是满分", () => {
    expect(proficiency(a("mining", 0, 0))).toBe(5);
  });

  test("一次成功不给满分", () => {
    expect(proficiency(a("mining", 1, 1))).toBeLessThan(8);
  });

  test("干得多了才敢说擅长", () => {
    expect(proficiency(a("mining", 13, 12))).toBeGreaterThanOrEqual(8);
  });

  test("一直失败就低分，且永远在 0..10 之间", () => {
    expect(proficiency(a("combat", 6, 0))).toBeLessThanOrEqual(3);
    for (const [t, s] of [[0, 0], [1, 1], [100, 100], [3, 99]] as const) {
      const p = proficiency(a("x", t, s));
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(10);
    }
  });
});

describe("summarizeHabits —— 从计数里读出他的习惯", () => {
  const habits = [
    h(HABIT.command("#back"), 12),
    h(HABIT.command("#free"), 5),
    h(HABIT.command("#stop"), 3),
    h(HABIT.command("#attack"), 1),
    h(HABIT.hour(21), 9),
    h(HABIT.hour(22), 7),
    h(HABIT.hour(23), 4),
    h(HABIT.hour(9), 1),
    h(HABIT.chat, 20),
    h(HABIT.chatChars, 100),
    h(HABIT.asked, 3),
  ];
  const s = summarizeHabits(habits);

  test("指令按次数排，只留前三", () => {
    expect(s.commands.map((c) => c.trigger)).toEqual(["#back", "#free", "#stop"]);
  });

  test("在线时段按热度取前三，再按钟点排回来", () => {
    expect(s.hours.map((x) => x.hour)).toEqual([21, 22, 23]);
  });

  test("平均每句话几个字", () => {
    expect(s.chatLines).toBe(20);
    expect(s.avgChars).toBe(5);
  });

  test("说话短就说短，不硬夸", () => {
    expect(habitLine(s)).toContain("说话很短");
    expect(habitLine(s)).toContain("21-23点");
    expect(habitLine(s)).toContain("#back(12)");
  });

  test("没有数据时什么都不说，不编", () => {
    expect(habitLine(summarizeHabits([]))).toBe("");
  });
});

describe("skillLine —— 没试过的本事不列", () => {
  test("只列真干过的，按熟练度降序", () => {
    const line = skillLine([a("mining", 13, 12), a("combat", 6, 1), a("farming", 0, 0)]);
    expect(line).toContain("挖矿");
    expect(line).toContain("打架");
    expect(line).not.toContain("种地");
    expect(line.indexOf("挖矿")).toBeLessThan(line.indexOf("打架"));
  });

  test("什么都没干过就不写这一行", () => {
    expect(skillLine([a("mining", 0, 0)])).toBe("");
  });
});

describe("recentLessons —— 新的在前、同样的只说一次", () => {
  test("去重 + 限条数", () => {
    const got = recentLessons(
      [l("lesson", "别在平原过夜", 1), l("lesson", "别在平原过夜", 5), l("mining", "y=-59 没钻石", 3)],
      5,
    );
    expect(got.length).toBe(2);
    expect(got[0]!.text).toBe("别在平原过夜");
    expect(got[0]!.at).toBe(5);
  });
});

describe("profileDigest —— 喂给大脑的那段", () => {
  test("什么都没有时返回空串（别往提示词里塞废话）", () => {
    expect(profileDigest({ habits: [], adaptation: [], lessons: [] })).toBe("");
  });

  test("三块都写清楚，教训带上是哪方面的", () => {
    const text = profileDigest({
      habits: [h(HABIT.command("#back"), 12), h(HABIT.chat, 20), h(HABIT.chatChars, 100)],
      adaptation: [a("mining", 13, 12), a("combat", 6, 1)],
      lessons: [l("lesson", "晚上别在平原乱走", 2), l("preference", "喜欢挖矿不喜欢下矿洞", 3)],
    });
    expect(text).toContain("他的习惯");
    expect(text).toContain("熟练度");
    expect(text).toContain("挖矿");
    expect(text).toContain("他喜欢/不喜欢");
    expect(text).toContain("喜欢挖矿");
    expect(text).toContain("晚上别在平原乱走");
    expect(text).toContain("教训");
  });

  test("教训条数可控（提示词是每回合都要付钱的地方）", () => {
    const lessons = Array.from({ length: 12 }, (_, i) => l("lesson", "教训" + i, i));
    const text = profileDigest({ habits: [], adaptation: [], lessons }, 3);
    // 取的是**最新**的三条（at 越大越新），第四条不能挤进来
    expect(text).toContain("教训11");
    expect(text).toContain("教训10");
    expect(text).toContain("教训9");
    expect(text).not.toContain("教训8");
  });
});

describe("profileBrief —— 游戏里 #profile 那一句", () => {
  test("没数据时说的是人话，不是空", () => {
    expect(profileBrief({ habits: [], adaptation: [], lessons: [] })).toContain("多带我干点活");
  });

  test("永远不会超过聊天栏能放的长度", () => {
    const many = Array.from({ length: 12 }, (_, i) => a("mining", 10 + i, 9));
    const text = profileBrief(
      { habits: [h(HABIT.command("#back"), 99)], adaptation: many, lessons: [l("lesson", "x", 1)] },
      60,
    );
    expect(text.length).toBeLessThanOrEqual(60);
  });

  test("有数据时把熟练度和习惯都报出来", () => {
    const text = profileBrief({
      habits: [h(HABIT.command("#back"), 12)],
      adaptation: [a("mining", 13, 12)],
      lessons: [],
    });
    expect(text).toContain("挖矿");
    expect(text).toContain("12/13");
    expect(text).toContain("#back");
  });
});
