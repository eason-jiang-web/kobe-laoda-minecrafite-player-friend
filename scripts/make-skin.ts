/**
 * Generates 猫娘's skin (an original 64x64 Minecraft skin) plus a front-view
 * preview you can eyeball before installing it.
 *
 *   bun scripts/make-skin.ts
 *   -> assets/skins/maoniang.png      (the skin, standard Steve/classic model)
 *   -> assets/skins/maoniang-preview.png  (8x front view, just to look at)
 *
 * Why generated instead of downloaded: skins on the sharing sites are other
 * people's art (and those sites block scripted downloads anyway). This one is
 * ours, and it's plain code so it can be tweaked.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

// ── tiny PNG encoder (RGBA, no filtering) ─────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── canvas ────────────────────────────────────────────────────────────────
type RGBA = [number, number, number, number];
const CLEAR: RGBA = [0, 0, 0, 0];

class Canvas {
  readonly data: Uint8Array;

  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint8Array(w * h * 4);
  }

  px(x: number, y: number, c: RGBA): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = c[3];
  }

  rect(x: number, y: number, w: number, h: number, c: RGBA): void {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.px(x + dx, y + dy, c);
  }

  /** Copy a face (w x h) from another canvas, skipping fully transparent px. */
  blit(src: Canvas, sx: number, sy: number, dx: number, dy: number, w: number, h: number): void {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = ((sy + y) * src.w + (sx + x)) * 4;
        if (src.data[i + 3] === 0) continue;
        this.px(dx + x, dy + y, [src.data[i]!, src.data[i + 1]!, src.data[i + 2]!, src.data[i + 3]!]);
      }
    }
  }

  png(): Buffer {
    return encodePng(this.w, this.h, this.data);
  }
}

// ── palette ───────────────────────────────────────────────────────────────
const SKIN: RGBA = [247, 214, 196, 255];
const SKIN_SHADE: RGBA = [232, 188, 170, 255];
const HAIR: RGBA = [247, 160, 194, 255];
const HAIR_DARK: RGBA = [211, 121, 158, 255];
const HAIR_LIGHT: RGBA = [255, 214, 232, 255];
const EYE: RGBA = [74, 46, 58, 255];
const EYE_LIGHT: RGBA = [255, 255, 255, 255];
const BLUSH: RGBA = [246, 150, 162, 255];
const DRESS: RGBA = [253, 250, 252, 255];
const DRESS_TRIM: RGBA = [242, 156, 190, 255];
const SOCK: RGBA = [255, 253, 254, 255];
const SHOE: RGBA = [124, 88, 104, 255];
const MOUTH: RGBA = [196, 110, 120, 255];

const s = new Canvas(64, 64);

// ── head (8x8 faces) ──────────────────────────────────────────────────────
// layout: top(8,0) bottom(16,0) right(0,8) front(8,8) left(16,8) back(24,8)
const headTop: [number, number] = [8, 0];
const headBottom: [number, number] = [16, 0];
const headRight: [number, number] = [0, 8];
const headFront: [number, number] = [8, 8];
const headLeft: [number, number] = [16, 8];
const headBack: [number, number] = [24, 8];

s.rect(headFront[0], headFront[1], 8, 8, SKIN);
s.rect(headRight[0], headRight[1], 8, 8, SKIN);
s.rect(headLeft[0], headLeft[1], 8, 8, SKIN);
s.rect(headBottom[0], headBottom[1], 8, 8, SKIN);
s.rect(headTop[0], headTop[1], 8, 8, HAIR);
s.rect(headBack[0], headBack[1], 8, 8, HAIR);

// sides: hairline on top, hair swept to the back, shaded underneath
s.rect(headRight[0], headRight[1], 8, 2, HAIR);
s.rect(headLeft[0], headLeft[1], 8, 2, HAIR);
s.rect(headRight[0], headRight[1], 3, 8, HAIR);
s.rect(headLeft[0] + 5, headLeft[1], 3, 8, HAIR);
s.rect(headRight[0], headRight[1] + 2, 3, 1, HAIR_DARK);
s.rect(headLeft[0] + 5, headLeft[1] + 2, 3, 1, HAIR_DARK);

// face: bangs, side locks, big shiny eyes, blush, tiny mouth
const F = headFront;
s.rect(F[0], F[1], 8, 3, HAIR);              // bangs
s.px(F[0] + 3, F[1] + 3, HAIR);              // a strand dipping between the eyes
s.rect(F[0], F[1] + 3, 1, 5, HAIR);          // side locks framing the face
s.rect(F[0] + 7, F[1] + 3, 1, 5, HAIR);
s.px(F[0] + 1, F[1] + 3, EYE_LIGHT);         // eye shine (top-left of each eye)
s.px(F[0] + 2, F[1] + 3, EYE);
s.px(F[0] + 5, F[1] + 3, EYE_LIGHT);
s.px(F[0] + 6, F[1] + 3, EYE);
s.rect(F[0] + 1, F[1] + 4, 2, 1, EYE);       // lower half of the eyes
s.rect(F[0] + 5, F[1] + 4, 2, 1, EYE);
s.px(F[0] + 1, F[1] + 6, BLUSH);
s.px(F[0] + 6, F[1] + 6, BLUSH);
s.px(F[0] + 3, F[1] + 6, MOUTH);
s.px(F[0] + 4, F[1] + 6, MOUTH);
s.px(F[0] + 3, F[1] + 5, SKIN); // keep the mouth small and cat-like, not a slab

// ── hat layer: cat ears + hair volume ─────────────────────────────────────
const hatTop: [number, number] = [40, 0];
const hatRight: [number, number] = [32, 8];
const hatFront: [number, number] = [40, 8];
const hatLeft: [number, number] = [48, 8];
const hatBack: [number, number] = [56, 8];

// long hair down the back + past the shoulders
s.rect(hatBack[0], hatBack[1], 8, 8, HAIR);
s.rect(hatBack[0] + 2, hatBack[1] + 3, 4, 5, HAIR_DARK);
s.rect(hatRight[0] + 3, hatRight[1], 5, 8, HAIR);
s.rect(hatLeft[0], hatLeft[1], 5, 8, HAIR);
s.rect(hatRight[0] + 6, hatRight[1] + 1, 2, 6, HAIR_DARK);
s.rect(hatLeft[0], hatLeft[1] + 1, 2, 6, HAIR_DARK);
// fringe volume across the forehead
s.rect(hatFront[0], hatFront[1], 8, 1, HAIR_LIGHT);

// cat ears: a triangle on each top corner, with pink inside
const ear = (ox: number, dir: 1 | -1) => {
  for (let row = 0; row < 3; row++) {
    const width = 3 - row;
    const x = dir === 1 ? ox + row : ox - row - width + 1;
    s.rect(hatTop[0] + x, hatTop[1] + row, width, 1, HAIR);
    if (row === 1) s.px(hatTop[0] + x + (dir === 1 ? 0 : width - 1), hatTop[1] + row, DRESS_TRIM);
  }
};
ear(0, 1);
ear(7, -1);

// the same ears seen from the front: little points above the hairline
s.rect(hatFront[0] + 0, hatFront[1] + 0, 2, 2, HAIR);
s.rect(hatFront[0] + 6, hatFront[1] + 0, 2, 2, HAIR);
s.px(hatFront[0] + 0, hatFront[1] + 1, HAIR_DARK);
s.px(hatFront[0] + 7, hatFront[1] + 1, HAIR_DARK);
// ...and from the sides, so they read at any angle
s.rect(hatRight[0] + 0, hatRight[1] + 0, 2, 3, HAIR);
s.rect(hatLeft[0] + 6, hatLeft[1] + 0, 2, 3, HAIR);
s.px(hatRight[0] + 1, hatRight[1] + 1, DRESS_TRIM);
s.px(hatLeft[0] + 6, hatLeft[1] + 1, DRESS_TRIM);

// ── body (8 wide x 12 tall x 4 deep) ──────────────────────────────────────
// top(20,16) bottom(28,16) right(16,20) front(20,20) left(28,20) back(32,20)
const bodyFront: [number, number] = [20, 20];
s.rect(16, 20, 4, 12, DRESS);
s.rect(28, 20, 4, 12, DRESS);
s.rect(bodyFront[0], bodyFront[1], 8, 12, DRESS);
s.rect(32, 20, 8, 12, DRESS);
s.rect(20, 16, 8, 4, DRESS);
s.rect(28, 16, 8, 4, DRESS);
// dress trim: collar, belt, hem
s.rect(bodyFront[0], bodyFront[1], 8, 1, DRESS_TRIM);
s.rect(bodyFront[0], bodyFront[1] + 6, 8, 1, DRESS_TRIM);
s.rect(bodyFront[0], bodyFront[1] + 11, 8, 1, DRESS_TRIM);
s.rect(16, 26, 4, 1, DRESS_TRIM);
s.rect(28, 26, 4, 1, DRESS_TRIM);
s.rect(32, 26, 8, 1, DRESS_TRIM);
s.rect(32, 31, 8, 1, DRESS_TRIM);
// a little bow on the chest
s.px(bodyFront[0] + 3, bodyFront[1] + 2, DRESS_TRIM);
s.px(bodyFront[0] + 4, bodyFront[1] + 2, DRESS_TRIM);
s.px(bodyFront[0] + 3, bodyFront[1] + 3, DRESS_TRIM);
s.px(bodyFront[0] + 4, bodyFront[1] + 3, DRESS_TRIM);

// ── arms (4 wide x 12 tall), classic/Steve model ──────────────────────────
// right arm front(44,20) back(52,20) right(40,20) left(48,20) top(44,16) bottom(48,16)
s.rect(40, 20, 4, 12, SKIN);
s.rect(44, 20, 4, 12, SKIN);
s.rect(48, 20, 4, 12, SKIN);
s.rect(52, 20, 4, 12, SKIN);
s.rect(44, 16, 4, 4, SKIN);
s.rect(48, 16, 4, 4, SKIN);
// short sleeves
for (const x of [40, 44, 48, 52]) s.rect(x, 20, 4, 3, DRESS);
// left arm front(36,52) back(44,52) right(32,52) left(40,52) top(36,48) bottom(40,48)
s.rect(32, 52, 4, 12, SKIN);
s.rect(36, 52, 4, 12, SKIN);
s.rect(40, 52, 4, 12, SKIN);
s.rect(44, 52, 4, 12, SKIN);
s.rect(36, 48, 4, 4, SKIN);
s.rect(40, 48, 4, 4, SKIN);
for (const x of [32, 36, 40, 44]) s.rect(x, 52, 4, 3, DRESS);
// white cuffs at the wrists (reads as little paws/gloves)
for (const x of [40, 44, 48, 52]) s.rect(x, 29, 4, 3, DRESS);
for (const x of [32, 36, 40, 44]) s.rect(x, 61, 4, 3, DRESS);
// shade the underside of both arms
for (const x of [40, 44, 48, 52]) s.px(x + 3, 31, SKIN_SHADE);
for (const x of [32, 36, 40, 44]) s.px(x + 3, 63, SKIN_SHADE);

// ── legs (4 wide x 12 tall) ───────────────────────────────────────────────
// right leg front(4,20) back(12,20) right(0,20) left(8,20) top(4,16) bottom(8,16)
s.rect(0, 20, 4, 12, SKIN);
s.rect(4, 20, 4, 12, SKIN);
s.rect(8, 20, 4, 12, SKIN);
s.rect(12, 20, 4, 12, SKIN);
s.rect(4, 16, 4, 4, DRESS_TRIM);
s.rect(8, 16, 4, 4, DRESS_TRIM);
// left leg front(20,52) back(28,52) right(16,52) left(24,52) top(20,48) bottom(24,48)
s.rect(16, 52, 4, 12, SKIN);
s.rect(20, 52, 4, 12, SKIN);
s.rect(24, 52, 4, 12, SKIN);
s.rect(28, 52, 4, 12, SKIN);
s.rect(20, 48, 4, 4, DRESS_TRIM);
s.rect(24, 48, 4, 4, DRESS_TRIM);
// thigh-high socks + shoes on both legs
for (const [x0, y0] of [[0, 20], [4, 20], [8, 20], [12, 20], [16, 52], [20, 52], [24, 52], [28, 52]] as const) {
  s.rect(x0, y0 + 5, 4, 4, SOCK);
  s.rect(x0, y0 + 9, 4, 3, SHOE);
}

// ── overlays: tail on the body, boots ─────────────────────────────────────
// body overlay back face is (32,36); draw a fluffy tail sticking out
s.rect(34, 38, 4, 8, HAIR);
s.rect(35, 36, 2, 3, HAIR);
s.rect(35, 45, 2, 2, HAIR_LIGHT);
s.rect(34, 40, 1, 5, HAIR_DARK);

mkdirSync("assets/skins", { recursive: true });
writeFileSync("assets/skins/maoniang.png", s.png());

// ── preview: 8x front view (head + body + arms + legs, overlays composited) ─
const SCALE = 8;
const preview = new Canvas(16 * SCALE, 32 * SCALE);
const parts: Array<[number, number, number, number, number, number]> = [
  // [srcX, srcY, dstX, dstY, w, h] in skin pixels, front view
  [headFront[0], headFront[1], 4, 0, 8, 8],
  [hatFront[0], hatFront[1] - 32 + 32, 4, 0, 8, 8], // hat layer front is (40,8) = headFront + (32,0)
  [bodyFront[0], bodyFront[1], 4, 8, 8, 12],
  [20, 36, 4, 8, 8, 12], // body overlay front
  [44, 20, 0, 8, 4, 12], // right arm
  [44, 36, 0, 8, 4, 12], // right arm overlay
  [36, 52, 12, 8, 4, 12], // left arm
  [52, 52, 12, 8, 4, 12], // left arm overlay
  [4, 20, 4, 20, 4, 12], // right leg
  [4, 36, 4, 20, 4, 12], // right leg overlay
  [20, 52, 8, 20, 4, 12], // left leg
  [4, 52, 8, 20, 4, 12], // left leg overlay
];
const scaled = new Canvas(16, 32);
for (const [sx, sy, dx, dy, w, h] of parts) scaled.blit(s, sx, sy, dx, dy, w, h);
for (let y = 0; y < 32; y++) {
  for (let x = 0; x < 16; x++) {
    const i = (y * 16 + x) * 4;
    const c: RGBA = [scaled.data[i]!, scaled.data[i + 1]!, scaled.data[i + 2]!, scaled.data[i + 3]!];
    if (c[3] === 0) continue;
    preview.rect(x * SCALE, y * SCALE, SCALE, SCALE, c);
  }
}
writeFileSync("assets/skins/maoniang-preview.png", preview.png());

// ── icon: her head, for the desktop shortcuts ─────────────────────────────
// Head front + the hat layer (bangs, ears) composited, scaled 8x to 64x64.
const head = new Canvas(8, 8);
head.blit(s, headFront[0], headFront[1], 0, 0, 8, 8);
head.blit(s, hatFront[0], hatFront[1], 0, 0, 8, 8);

const ICON = 64;
const icon = new Canvas(ICON, ICON);
for (let y = 0; y < 8; y++) {
  for (let x = 0; x < 8; x++) {
    const i = (y * 8 + x) * 4;
    const c: RGBA = [head.data[i]!, head.data[i + 1]!, head.data[i + 2]!, head.data[i + 3]!];
    if (c[3] === 0) continue;
    icon.rect(x * 8, y * 8, 8, 8, c);
  }
}

/**
 * Classic BMP-style .ico (32bpp BGRA + AND mask). Windows Explorer also takes
 * PNG-in-ICO, but .NET's System.Drawing.Icon does not, and I want to be able to
 * validate the file after writing it.
 */
function encodeIco(width: number, height: number, rgba: Uint8Array): Buffer {
  const xorSize = width * height * 4;
  const andRow = Math.ceil(width / 32) * 4;
  const dib = Buffer.alloc(40 + xorSize + andRow * height); // AND mask stays zero = opaque

  dib.writeUInt32LE(40, 0);
  dib.writeInt32LE(width, 4);
  dib.writeInt32LE(height * 2, 8); // XOR + AND
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  dib.writeUInt32LE(0, 16); // BI_RGB
  dib.writeUInt32LE(xorSize, 20);

  let o = 40;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      dib[o++] = rgba[i + 2]!;
      dib[o++] = rgba[i + 1]!;
      dib[o++] = rgba[i]!;
      dib[o++] = rgba[i + 3]!;
    }
  }

  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header[6] = width >= 256 ? 0 : width;
  header[7] = height >= 256 ? 0 : height;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(dib.length, 14);
  header.writeUInt32LE(22, 18);

  return Buffer.concat([header, dib]);
}

writeFileSync("assets/skins/maoniang-head.png", icon.png());
writeFileSync("assets/skins/maoniang-head.ico", encodeIco(ICON, ICON, icon.data));

console.log("wrote assets/skins/maoniang.png, maoniang-preview.png, maoniang-head.png/.ico");
