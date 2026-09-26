/**
 * Tiny pixel-art helpers shared by the skin generators:
 * RGBA canvas + PNG encoder + (BMP-style) ICO encoder.
 *
 * Deliberately dependency-free and self-contained — see scripts/make-skin.ts
 * for the catgirl version, which carries its own copy.
 */
import { deflateSync } from "node:zlib";

export type RGBA = [number, number, number, number];
export const CLEAR: RGBA = [0, 0, 0, 0];

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

export class Canvas {
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

  /** Copy a face, skipping fully transparent pixels (so overlays composite). */
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
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * 4 + 1)] = 0;
      Buffer.from(this.data.buffer, this.data.byteOffset + y * this.w * 4, this.w * 4).copy(
        raw,
        y * (this.w * 4 + 1) + 1,
      );
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

/** Classic BMP-style .ico (32bpp BGRA + AND mask) — Windows Explorer and .NET both read it. */
export function encodeIco(width: number, height: number, rgba: Uint8Array): Buffer {
  const xorSize = width * height * 4;
  const andRow = Math.ceil(width / 32) * 4;
  const dib = Buffer.alloc(40 + xorSize + andRow * height);

  dib.writeUInt32LE(40, 0);
  dib.writeInt32LE(width, 4);
  dib.writeInt32LE(height * 2, 8);
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  dib.writeUInt32LE(0, 16);
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
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = width >= 256 ? 0 : width;
  header[7] = height >= 256 ? 0 : height;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(dib.length, 14);
  header.writeUInt32LE(22, 18);

  return Buffer.concat([header, dib]);
}

/** Scale a canvas by an integer factor (nearest neighbour, keeps it pixel-art crisp). */
export function upscale(src: Canvas, factor: number): Canvas {
  const out = new Canvas(src.w * factor, src.h * factor);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      const c: RGBA = [src.data[i]!, src.data[i + 1]!, src.data[i + 2]!, src.data[i + 3]!];
      if (c[3] === 0) continue;
      out.rect(x * factor, y * factor, factor, factor, c);
    }
  }
  return out;
}
