/**
 * Minecraft version preflight.
 *
 * Mineflayer can only speak versions that minecraft-data ships protocol data
 * for. Anything else dies deep inside the handshake with a cryptic error, so we
 * check MC_VERSION up front and tell you what IS supported.
 *
 * This is only half the contract: MC_VERSION must also match the version the
 * player actually launched, exactly — the server does the other half of the
 * check and just drops the connection.
 */
import minecraftData from "minecraft-data";

/** Release versions only — the raw list also carries snapshots and pre-releases. */
export function supportedVersions(): string[] {
  return minecraftData.supportedVersions.pc.filter((v) => /^\d+\.\d+(\.\d+)?$/.test(v));
}

export function isSupportedVersion(version: string): boolean {
  return supportedVersions().includes(version);
}

function parts(v: string): [number, number, number] {
  const [a, b, c] = v.split(".").map((n) => Number(n) || 0);
  return [a ?? 0, b ?? 0, c ?? 0];
}

/**
 * The supported release closest to `version`, for "did you mean…?".
 * Same major.minor wins (nearest patch, ties to the newer one); otherwise the
 * newest release of the closest major.minor that actually exists.
 */
export function closestVersion(version: string): string | null {
  const all = supportedVersions();
  if (all.length === 0) return null;

  const [wMajor, wMinor, wPatch] = parts(version);

  const sameMinor = all.filter((v) => {
    const [a, b] = parts(v);
    return a === wMajor && b === wMinor;
  });
  if (sameMinor.length > 0) {
    let best: string | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const v of sameMinor) {
      const dist = Math.abs(parts(v)[2] - wPatch);
      if (dist <= bestDist) {
        bestDist = dist;
        best = v;
      }
    }
    return best;
  }

  let bestMinor: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const v of all) {
    const [a, b] = parts(v);
    const score = Math.abs(a - wMajor) * 1000 + Math.abs(b - wMinor);
    if (score < bestScore) {
      bestScore = score;
      bestMinor = a + "." + b;
    }
  }
  if (bestMinor === null) return null;

  const group = all.filter((v) => v === bestMinor || v.startsWith(bestMinor + "."));
  return group[group.length - 1] ?? null;
}

/** Throws something a human can act on. Call this right before createBot(). */
export function assertSupportedVersion(version: string): void {
  if (isSupportedVersion(version)) return;
  const near = closestVersion(version);
  throw new Error(
    'MC_VERSION="' + version + '" is not a Minecraft version mineflayer can speak.' +
      (near ? " Closest supported release: " + near + "." : "") +
      " Run `bun run mc:versions` for the list — and it has to match the version you" +
      " launched in PCL exactly, down to the last digit.",
  );
}
