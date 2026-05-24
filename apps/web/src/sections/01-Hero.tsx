"use client";

import { brand } from "@/lib/content";

/**
 * 01 — Hero. Full-bleed cinematic background with floating micro-labels in the
 * corners and a "scroll down" cue centered at the bottom. In the source this is a
 * looping video; we use the one clean captured clip as a tasteful stand-in behind
 * a dark scrim. The PinnedFrame (brand/nav/email) overlays this from the layout.
 */
export function Hero() {
  return (
    <section id="hero" className="relative h-[100svh] w-full overflow-hidden bg-ink">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/video/banner.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0 bg-black/20" />

      {/* center mid labels (client/credit style) */}
      <div className="absolute inset-0 flex items-center justify-between px-[10px] text-white md:px-5">
        <span className="u-label max-w-[140px]">{brand.tagline}</span>
        <span className="u-label max-w-[140px] text-right">spawns next to you</span>
      </div>

      {/* scroll cue */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white">
        <span className="u-label">scroll down</span>
      </div>
    </section>
  );
}
