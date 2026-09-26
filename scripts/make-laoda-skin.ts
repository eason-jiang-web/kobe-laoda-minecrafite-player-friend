/**
 * 牢大（Laoda）的皮肤 + 桌面图标 —— 原版 64x64，Steve/classic 模型。
 *
 *   bun scripts/make-laoda-skin.ts
 *   -> assets/skins/laoda.png            皮肤
 *   -> assets/skins/laoda-preview.png    8x 正面预览
 *   -> assets/skins/laoda-head.png/.ico  头像（桌面快捷方式的图标）
 *
 * 褐色皮肤 + 黑色短发 + 湖人紫金 24 号球衣 + 白球鞋。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Canvas, encodeIco, upscale, type RGBA } from "./_pixel.ts";

// ── palette ───────────────────────────────────────────────────────────────
const SKIN: RGBA = [141, 85, 36, 255]; // 褐色
const SKIN_SHADE: RGBA = [112, 64, 26, 255];
const HAIR: RGBA = [26, 22, 20, 255];
// 角色卡写的是"褪色的紫金"——所以是洗了很多水的那种紫金，不是崭新的
const PURPLE: RGBA = [96, 58, 122, 255]; // 褪色湖人紫
const PURPLE_DARK: RGBA = [70, 41, 88, 255];
const GOLD: RGBA = [212, 166, 74, 255]; // 褪色湖人金
const WHITE: RGBA = [245, 243, 236, 255];
const EYE: RGBA = [28, 22, 20, 255];
const MOUTH: RGBA = [92, 51, 38, 255];

const s = new Canvas(64, 64);

// face coordinates (standard skin layout)
const headTop: [number, number] = [8, 0];
const headBottom: [number, number] = [16, 0];
const headRight: [number, number] = [0, 8];
const headFront: [number, number] = [8, 8];
const headLeft: [number, number] = [16, 8];
const headBack: [number, number] = [24, 8];
const hatTop: [number, number] = [40, 0];
const hatFront: [number, number] = [40, 8];
const hatRight: [number, number] = [32, 8];
const hatLeft: [number, number] = [48, 8];

// ── head ──────────────────────────────────────────────────────────────────
s.rect(headFront[0], headFront[1], 8, 8, SKIN);
s.rect(headRight[0], headRight[1], 8, 8, SKIN);
s.rect(headLeft[0], headLeft[1], 8, 8, SKIN);
s.rect(headBottom[0], headBottom[1], 8, 8, SKIN);
s.rect(headTop[0], headTop[1], 8, 8, HAIR); // 短发：头顶全是头发
s.rect(headBack[0], headBack[1], 8, 8, HAIR);

// 两侧：短发的发际线 + 后脑
s.rect(headRight[0], headRight[1], 8, 2, HAIR);
s.rect(headLeft[0], headLeft[1], 8, 2, HAIR);
s.rect(headRight[0], headRight[1], 3, 5, HAIR);
s.rect(headLeft[0] + 5, headLeft[1], 3, 5, HAIR);
s.rect(headRight[0], headRight[1] + 3, 3, 1, SKIN_SHADE);
s.rect(headLeft[0] + 5, headLeft[1] + 3, 3, 1, SKIN_SHADE);

const F = headFront;
s.rect(F[0], F[1], 8, 2, HAIR); // 额发
s.rect(F[0] + 1, F[1] + 2, 2, 1, HAIR); // 眉毛一边
s.rect(F[0] + 5, F[1] + 2, 2, 1, HAIR); // 眉毛另一边
s.px(F[0] + 1, F[1] + 3, WHITE); // 眼睛上排：高光 + 瞳孔
s.px(F[0] + 2, F[1] + 3, EYE);
s.px(F[0] + 5, F[1] + 3, WHITE);
s.px(F[0] + 6, F[1] + 3, EYE);
s.rect(F[0] + 1, F[1] + 4, 2, 1, EYE); // 眼睛下排
s.rect(F[0] + 5, F[1] + 4, 2, 1, EYE);
s.px(F[0] + 2, F[1] + 6, MOUTH); // 笑：白牙
s.rect(F[0] + 3, F[1] + 6, 2, 1, WHITE);
s.px(F[0] + 5, F[1] + 6, MOUTH);
s.px(F[0] + 0, F[1] + 4, SKIN_SHADE);
s.px(F[0] + 7, F[1] + 4, SKIN_SHADE);

// 帽子层（第二层）：让短发有点厚度
s.rect(hatTop[0], hatTop[1], 8, 8, HAIR);
s.rect(hatFront[0], hatFront[1], 8, 1, HAIR);
s.rect(hatRight[0], hatRight[1], 8, 1, HAIR);
s.rect(hatLeft[0], hatLeft[1], 8, 1, HAIR);

// ── body: 24 号紫金球衣 ───────────────────────────────────────────────────
const bodyFront: [number, number] = [20, 20];
s.rect(16, 20, 4, 12, PURPLE);
s.rect(28, 20, 4, 12, PURPLE);
s.rect(bodyFront[0], bodyFront[1], 8, 12, PURPLE);
s.rect(32, 20, 8, 12, PURPLE);
s.rect(20, 16, 8, 4, PURPLE);
s.rect(28, 16, 8, 4, PURPLE);

// 领口 + 下摆金边
s.rect(bodyFront[0], bodyFront[1], 8, 1, GOLD);
s.rect(16, 20, 4, 1, GOLD);
s.rect(28, 20, 4, 1, GOLD);
s.rect(32, 20, 8, 1, GOLD);
s.rect(bodyFront[0], bodyFront[1] + 7, 8, 1, GOLD);
s.rect(16, 27, 4, 1, GOLD);
s.rect(28, 27, 4, 1, GOLD);
s.rect(32, 27, 8, 1, GOLD);

// 号码 24（金色），胸前：两个数字各 2 列，中间留 1 列空隙
const numTop = bodyFront[1] + 3;
const nx = bodyFront[0];
// "2"（第 1-2 列）
s.rect(nx + 1, numTop, 2, 1, GOLD);
s.px(nx + 2, numTop + 1, GOLD);
s.rect(nx + 1, numTop + 2, 2, 1, GOLD);
s.px(nx + 1, numTop + 3, GOLD);
s.rect(nx + 1, numTop + 4, 2, 1, GOLD);
// "4"（第 4-6 列）
s.px(nx + 5, numTop, GOLD);
s.rect(nx + 4, numTop + 1, 2, 1, GOLD);
s.rect(nx + 4, numTop + 2, 3, 1, GOLD);
s.px(nx + 5, numTop + 3, GOLD);
s.px(nx + 5, numTop + 4, GOLD);

// 背后：一双交叉的"肘子"（X）+ 大大的 24
const bx = 32;
s.px(bx + 1, 20, GOLD); // 交叉的肘子（左上 -> 右下）
s.px(bx + 2, 21, GOLD);
s.px(bx + 6, 20, GOLD); // 另一条（右上 -> 左下）
s.px(bx + 5, 21, GOLD);

const backTop = 20 + 3;
s.rect(32 + 2, backTop, 3, 1, GOLD);
s.px(32 + 4, backTop + 1, GOLD);
s.px(32 + 3, backTop + 2, GOLD);
s.px(32 + 2, backTop + 3, GOLD);
s.rect(32 + 2, backTop + 4, 3, 1, GOLD);
s.px(32 + 5, backTop, GOLD);
s.px(32 + 5, backTop + 4, GOLD);
s.rect(32 + 6, backTop + 1, 1, 1, GOLD);
s.px(32 + 7, backTop + 2, GOLD);
s.px(32 + 7, backTop + 3, GOLD);

// ── shorts + 腿 ───────────────────────────────────────────────────────────
const legFaces: Array<[number, number]> = [
  [0, 20], [4, 20], [8, 20], [12, 20],      // 右腿
  [16, 52], [20, 52], [24, 52], [28, 52],   // 左腿
];
for (const [x, y] of legFaces) {
  s.rect(x, y, 4, 12, SKIN);
  s.rect(x, y, 4, 5, PURPLE);          // 短裤
  s.rect(x, y + 4, 4, 1, GOLD);        // 裤边金线
  s.rect(x, y + 9, 4, 3, WHITE);       // 白球鞋
  s.rect(x, y + 11, 4, 1, GOLD);       // 鞋底金线
}
s.rect(4, 16, 4, 4, PURPLE_DARK); // 腰
s.rect(8, 16, 4, 4, PURPLE_DARK);
s.rect(20, 48, 4, 4, PURPLE_DARK);
s.rect(24, 48, 4, 4, PURPLE_DARK);

// ── arms: 褐色手臂 + 短袖 + 白色护腕 ──────────────────────────────────────
const armFaces: Array<[number, number]> = [
  [40, 20], [44, 20], [48, 20], [52, 20],   // 右臂
  [32, 52], [36, 52], [40, 52], [44, 52],   // 左臂
];
for (const [x, y] of armFaces) {
  s.rect(x, y, 4, 12, SKIN);
  s.rect(x, y, 4, 3, PURPLE);   // 无袖球衣的肩膀
  s.rect(x, y + 2, 4, 1, GOLD);
  s.rect(x, y + 9, 4, 2, WHITE); // 护腕
  s.px(x + 3, y + 11, SKIN_SHADE);
}
s.rect(44, 16, 4, 4, PURPLE);
s.rect(48, 16, 4, 4, PURPLE);
s.rect(36, 48, 4, 4, PURPLE);
s.rect(40, 48, 4, 4, PURPLE);

mkdirSync("assets/skins", { recursive: true });
writeFileSync("assets/skins/laoda.png", s.png());

// ── preview (8x front view) ───────────────────────────────────────────────
const front = new Canvas(16, 32);
const parts: Array<[number, number, number, number, number, number]> = [
  [headFront[0], headFront[1], 4, 0, 8, 8],
  [hatFront[0], hatFront[1], 4, 0, 8, 8],
  [bodyFront[0], bodyFront[1], 4, 8, 8, 12],
  [44, 20, 0, 8, 4, 12],
  [36, 52, 12, 8, 4, 12],
  [4, 20, 4, 20, 4, 12],
  [20, 52, 8, 20, 4, 12],
];
for (const [sx, sy, dx, dy, w, h] of parts) front.blit(s, sx, sy, dx, dy, w, h);
writeFileSync("assets/skins/laoda-preview.png", upscale(front, 8).png());

// ── icon: 褐色头像 ────────────────────────────────────────────────────────
const head = new Canvas(8, 8);
head.blit(s, headFront[0], headFront[1], 0, 0, 8, 8);
head.blit(s, hatFront[0], hatFront[1], 0, 0, 8, 8);
const icon = upscale(head, 8);
writeFileSync("assets/skins/laoda-head.png", icon.png());
writeFileSync("assets/skins/laoda-head.ico", encodeIco(64, 64, icon.data));

console.log("wrote assets/skins/laoda.png, laoda-preview.png, laoda-head.png/.ico");
