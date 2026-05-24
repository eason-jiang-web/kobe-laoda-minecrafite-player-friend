/**
 * Mobs we treat as "hostile" for the nearby-threat scan and combat targeting.
 * Shared by the state extractor (state/extract.ts) and the combat targeting in
 * the controller (bot/controller.ts) so both agree on what counts as a threat.
 */
export const HOSTILE = new Set([
  "zombie", "husk", "drowned", "skeleton", "stray", "creeper",
  "spider", "cave_spider", "enderman", "witch", "phantom", "pillager",
  "vindicator", "ravager", "blaze", "ghast", "piglin", "hoglin", "warden",
]);
