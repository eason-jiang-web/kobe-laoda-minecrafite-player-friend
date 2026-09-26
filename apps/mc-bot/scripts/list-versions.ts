/**
 * `bun run mc:versions` — which Minecraft versions can MC_VERSION be, and is
 * the one in .env any good? No Minecraft server needed.
 */
import { closestVersion, isSupportedVersion, supportedVersions } from "../src/bot/versions.js";

const configured = process.env.MC_VERSION ?? "1.20.6";
const all = supportedVersions();
const recent = all.slice(-24).reverse();

console.log("");
console.log("itto 的机器人（mineflayer / minecraft-data）能连的正式版：" + all.length + " 个");
console.log("");

if (isSupportedVersion(configured)) {
  console.log("  .env 里现在的 MC_VERSION = " + configured + "   ✅ 支持");
} else {
  const near = closestVersion(configured);
  console.log(
    "  .env 里现在的 MC_VERSION = " + configured + "   ❌ 不支持" +
      (near ? "（最接近的可用版本：" + near + "）" : ""),
  );
}

console.log("");
console.log("  最近 24 个（新 → 旧）：");
console.log("    " + recent.join("\n    "));
console.log("");
console.log("  换版本 = 两处一起改：PCL 里启动的版本，和 .env 里的 MC_VERSION。");
console.log("  差一个小版本都连不上（快照版/预览版没列在这里）。");
console.log("");
