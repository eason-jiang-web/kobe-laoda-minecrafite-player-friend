/**
 * Force prism-media / @discordjs/voice to use `opusscript` (pure JS) instead of
 * the prebuilt `@discordjs/opus`.
 *
 * Why: on this platform (Node 24 + Apple Silicon) the prebuilt `opus.node` is
 * missing an internal SILK symbol (`silk_NLSF2A`) and SIGABRTs ("missing symbol
 * called") the moment it decodes speech — i.e. as soon as anyone talks. We
 * can't remove @discordjs/opus from node_modules in this environment (perms), so
 * we make its `require` throw; prism's loader catches it and falls through to
 * opusscript (which bundles its own libopus as JS — slower, but crash-proof).
 *
 * Imported FIRST in index.ts so the patch is active before prism loads opus.
 */
import Module from "node:module";

type Loader = (request: string, ...rest: unknown[]) => unknown;
const mod = Module as unknown as { _load: Loader };
const original = mod._load;

mod._load = function (this: unknown, request: string, ...rest: unknown[]) {
  if (request === "@discordjs/opus") {
    throw new Error("itto: @discordjs/opus disabled — using opusscript (native opus.node crashes on SILK decode here)");
  }
  return original.call(this, request, ...rest);
};
