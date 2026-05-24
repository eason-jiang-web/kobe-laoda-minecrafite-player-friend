"use client";

/**
 * 01 — Hero. Full-bleed cinematic loop: an AI agent HUD scanning a Minecraft
 * world (taiga, lake, cozy cabin at golden hour). The footage already carries the
 * visual story — agent swarm status, planned route, action queue — so the scrim
 * stays light and we don't overlay extra labels that would fight the HUD. The
 * PinnedFrame (brand/nav/email corners) sits on top from the layout.
 */
export function Hero() {
  return (
    <section id="hero" className="relative h-[100svh] w-full overflow-hidden bg-ink">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/video/hero.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      {/* light scrim: just enough to keep the pinned-frame corners legible
          without burying the HUD */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/30" />

      {/* scroll cue */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white">
        <span className="u-label">scroll down</span>
      </div>
    </section>
  );
}
