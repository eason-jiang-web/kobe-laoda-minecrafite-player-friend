import { about, brand, worksWith } from "@/lib/content";

const fallbackSiteUrl = "https://itto.stephenhung.me";

function normalizeSiteUrl(value?: string) {
  const raw = value?.trim() || fallbackSiteUrl;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return new URL(withProtocol.replace(/\/+$/, ""));
}

export const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export function absoluteUrl(path = "/") {
  return new URL(path, siteUrl).toString();
}

export const seo = {
  title: "itto® — ai minecraft co-op buddy",
  description:
    "itto joins your minecraft world, follows you around, helps with tasks, remembers your world, and hangs in your discord call.",
  imageAlt: "itto, an ai minecraft co-op buddy in a cinematic minecraft world",
  keywords: [
    "itto",
    "ai minecraft bot",
    "minecraft co-op ai",
    "minecraft companion",
    "minecraft discord voice bot",
    "mineflayer ai",
    "mcp minecraft bot",
    "ai gaming companion",
    "hermes agent",
    "minecraft java bot",
  ],
};

export const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: brand.mark,
      url: absoluteUrl("/"),
      description: seo.description,
      inLanguage: "en-US",
    },
    {
      "@type": "SoftwareApplication",
      name: brand.name,
      applicationCategory: "GameApplication",
      operatingSystem: "Minecraft Java Edition",
      url: absoluteUrl("/"),
      description: about.intro,
      creator: {
        "@type": "Organization",
        name: "kalilabs",
        email: brand.email,
      },
      featureList: [
        "follows the player in minecraft",
        "acts through mineflayer and mcp tools",
        "talks in a discord voice call",
        "reads structured minecraft game state",
        "remembers bases, chests, and world facts",
        ...worksWith.map((item) => item.toLowerCase()),
      ],
    },
  ],
};
