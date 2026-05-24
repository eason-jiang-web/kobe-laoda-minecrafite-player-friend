import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { FooterReveal } from "@/components/FooterReveal";
import { SmoothScroll } from "@/components/SmoothScroll";
import { PinnedFrame } from "@/components/PinnedFrame";
import { jsonLd, seo, siteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: "itto",
  title: {
    default: seo.title,
    template: "%s | itto",
  },
  description: seo.description,
  keywords: seo.keywords,
  authors: [{ name: "kalilabs", url: "https://kalilabs.ai" }],
  creator: "kalilabs",
  publisher: "kalilabs",
  category: "technology",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "itto",
    title: seo.title,
    description: seo.description,
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: seo.imageAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: seo.title,
    description: seo.description,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f8f7f2",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body id="top">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <SmoothScroll>
          <FooterReveal />
          <PinnedFrame />
          <div className="relative z-10">{children}</div>
          <div aria-hidden="true" className="hidden h-[720px] md:block" />
        </SmoothScroll>
      </body>
    </html>
  );
}
