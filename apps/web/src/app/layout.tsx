import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";
import { PinnedFrame } from "@/components/PinnedFrame";

export const metadata: Metadata = {
  title: "itto® — your minecraft duo",
  description:
    "an ai buddy that spawns next to you, follows you around, helps out, and hangs in your discord call.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body id="top">
        <SmoothScroll>
          <PinnedFrame />
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
