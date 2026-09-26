import { describe, expect, test } from "bun:test";
import { classifySystemLine } from "./action-classify.js";
import {
  clearPlayerActions,
  peekPlayerActions,
  recordPlayerAction,
  takePlayerActions,
} from "./player-actions.js";

const OWNER = "eason";

describe("classifySystemLine — 从服务器播报里认出他的动作", () => {
  test("死亡（中文和英文都认）", () => {
    const zh = classifySystemLine("eason 被 僵尸 杀死了", OWNER);
    expect(zh?.kind).toBe("dead");
    expect(zh?.text).toContain("僵尸"); // 记住凶手，好还手
    expect(zh?.important).toBe(true);

    expect(classifySystemLine("eason was slain by Zombie", OWNER)?.kind).toBe("dead");
    expect(classifySystemLine("eason 掉出了这个世界", OWNER)?.kind).toBe("dead");
    expect(classifySystemLine("eason 在岩浆里游泳", OWNER)?.kind).toBe("dead");
  });

  test("完成进度：把进度名带出来", () => {
    const hit = classifySystemLine("eason 完成了进度 [探索时间]", OWNER);
    expect(hit?.kind).toBe("advancement");
    expect(hit?.text).toContain("探索时间");

    expect(classifySystemLine("eason has made the advancement [Stone Age]", OWNER)?.kind).toBe(
      "advancement",
    );
  });

  test("睡觉 / 起床 / 上下线", () => {
    expect(classifySystemLine("eason 睡着了", OWNER)?.kind).toBe("sleep");
    expect(classifySystemLine("eason is now sleeping", OWNER)?.kind).toBe("sleep");
    expect(classifySystemLine("eason 起床了", OWNER)?.kind).toBe("wake");
    expect(classifySystemLine("eason 加入了游戏", OWNER)?.kind).toBe("join");
    expect(classifySystemLine("eason 退出了游戏", OWNER)?.kind).toBe("leave");
  });

  test("不是他的事、或者他自己的聊天，都不算动作", () => {
    expect(classifySystemLine("steve 被 僵尸 杀死了", OWNER)).toBeNull();
    expect(classifySystemLine("<eason> 我刚死了", OWNER)).toBeNull(); // 他自己说的不算播报
    expect(classifySystemLine("eason 完成了进度 [x]", "Laoda")).toBeNull(); // owner 不是他
    expect(classifySystemLine("", OWNER)).toBeNull();
  });

  test("只在提示里说人话：不要催、要给出下一步", () => {
    expect(classifySystemLine("eason 被 苦力怕 杀死了", OWNER)?.text).toContain("掉落物");
    expect(classifySystemLine("eason 睡着了", OWNER)?.text).toContain("别吵");
  });
});

describe("player-actions — 动作队列", () => {
  test("记下来、取走、就没了（不会重复反应）", () => {
    clearPlayerActions();
    recordPlayerAction({ kind: "pickup", text: "他捡到钻石" });
    expect(takePlayerActions(["pickup"]).length).toBe(1);
    expect(takePlayerActions(["pickup"]).length).toBe(0);
    clearPlayerActions();
  });

  test("按类型分开取：紧急的和闲聊的互不抢", () => {
    clearPlayerActions();
    recordPlayerAction({ kind: "hurt", text: "他被打" });
    recordPlayerAction({ kind: "pickup", text: "他捡到钻石" });
    const urgent = takePlayerActions(["hurt", "dead"]);
    expect(urgent.map((a) => a.kind)).toEqual(["hurt"]);
    // 紧急的取走了，闲聊的还在
    expect(peekPlayerActions().map((a) => a.kind)).toEqual(["pickup"]);
    clearPlayerActions();
  });

  test("太老的动作会自己过期（隔五分钟再说'他刚被打了'很怪）", () => {
    clearPlayerActions();
    const old = Date.now() - 120_000;
    recordPlayerAction({ kind: "hurt", text: "他被打" }, old);
    expect(takePlayerActions(undefined, Date.now()).length).toBe(0);
    clearPlayerActions();
  });

  test("最多留 24 条，不会无限涨", () => {
    clearPlayerActions();
    for (let i = 0; i < 40; i++) recordPlayerAction({ kind: "pickup", text: "第" + i + "条" });
    const all = peekPlayerActions();
    expect(all.length).toBe(24);
    expect(all[all.length - 1]?.text).toBe("第39条");
    clearPlayerActions();
  });

  test("clear 之后干干净净（换连接时用）", () => {
    recordPlayerAction({ kind: "dead", text: "他死了" });
    clearPlayerActions();
    expect(peekPlayerActions().length).toBe(0);
  });
});
