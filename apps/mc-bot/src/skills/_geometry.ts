import type { Vec3Lit } from "@itto/shared";

const key = (p: Vec3Lit) => `${p.x},${p.y},${p.z}`;

const adjacent = (a: Vec3Lit, b: Vec3Lit): boolean =>
  Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && Math.abs(a.z - b.z) <= 1;

/**
 * Connected-component BFS over a set of block coords starting from `seed`.
 * Two coords are connected if they're within 1 on every axis (Chebyshev
 * adjacency). Used to grab a whole tree trunk (incl. branches) or an ore vein
 * from a flat findBlocks result. Pure geometry — keeps mineflayer out of skills.
 */
export function connectedComponent(coords: Vec3Lit[], seed: Vec3Lit, max = 64): Vec3Lit[] {
  const remaining = new Map(coords.map((c) => [key(c), c]));
  const out: Vec3Lit[] = [];
  const queue: Vec3Lit[] = [seed];
  remaining.delete(key(seed));
  out.push(seed);
  while (queue.length > 0 && out.length < max) {
    const cur = queue.shift()!;
    for (const [k, c] of remaining) {
      if (adjacent(cur, c)) {
        remaining.delete(k);
        out.push(c);
        queue.push(c);
      }
    }
  }
  return out;
}
