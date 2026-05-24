import type { MetadataRoute } from "next";
import { brand } from "@/lib/content";
import { seo } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: seo.title,
    short_name: brand.name,
    description: seo.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f7f2",
    theme_color: "#050505",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
