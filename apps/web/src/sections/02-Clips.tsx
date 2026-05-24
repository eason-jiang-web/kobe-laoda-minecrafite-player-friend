"use client";

import { clips } from "@/lib/content";
import { Reveal } from "@/components/Reveal";

/**
 * 02 — Clips (source: "Latest"). Desktop source geometry is an editorial
 * masonry: 160px header, two 720x436 feature tiles, then three 480x291 tiles.
 */
export function Clips() {
  const featureClips = clips.slice(0, 2);
  const smallClips = clips.slice(2, 5);

  return (
    <section id="clips" className="overflow-hidden bg-canvas pb-px pt-24">
      <Reveal y={60} className="mb-[62px] flex h-32 items-start justify-between px-[10px] md:px-5">
        <h2 className="font-display text-[160px] font-light uppercase leading-[0.8] tracking-[-0.05em] text-ink">
          clips
        </h2>
        <span className="font-display text-[160px] font-light leading-[0.8] tracking-[-0.05em] text-ink">
          {clips.length}
        </span>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2">
        {featureClips.map((clip, i) => (
          <Reveal key={clip.title} delay={i * 0.08} className="group">
            <div className="relative h-[436px] w-full overflow-hidden bg-ink">
              <video
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                src="/video/hero.mp4"
                autoPlay
                muted
                loop
                playsInline
              />
            </div>
            <div className="grid h-[41px] grid-cols-2 px-5 pt-3">
              <div>
                <span className="u-label text-ink">{clip.title}</span>
                <br />
                <span className="u-label text-muted">{clip.who}</span>
              </div>
              <span className="u-label text-ink">{clip.date}</span>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-[52px] grid grid-cols-1 md:grid-cols-3">
        {smallClips.map((clip, i) => (
          <Reveal key={clip.title} delay={i * 0.06} className="group">
            <div className="relative h-[291px] w-full overflow-hidden bg-ink">
              <video
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                src="/video/hero.mp4"
                autoPlay
                muted
                loop
                playsInline
              />
            </div>
            <div className="grid h-[41px] grid-cols-2 px-5 pt-3">
              <div>
                <span className="u-label text-ink">{clip.title}</span>
                <br />
                <span className="u-label text-muted">{clip.who}</span>
              </div>
              <span className="u-label text-ink">{clip.date}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
