"use client";

import { clips } from "@/lib/content";
import { ClipHoverCard } from "@/components/ClipHoverCard";
import { HeaderReveal } from "@/components/HeaderReveal";
import { Reveal } from "@/components/Reveal";

/**
 * 02 — Clips (source: "Latest"). Desktop source geometry is an editorial
 * masonry: 160px header, two 720x436 feature tiles, then 480x291 small tiles.
 */
export function Clips() {
  const featureClips = clips.slice(0, 2);

  return (
    <section id="clips" className="overflow-hidden bg-canvas pb-px pt-24">
      <div className="mb-[62px] flex h-32 items-start justify-between px-[10px] md:px-5">
        <HeaderReveal className="font-display text-[160px] font-light uppercase leading-[0.8] tracking-normal text-ink">
          clips
        </HeaderReveal>
        <HeaderReveal
          as="span"
          delay={0.08}
          className="inline-block font-display text-[160px] font-light leading-[0.8] tracking-normal text-ink"
        >
          {clips.length}
        </HeaderReveal>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2">
        {featureClips.map((clip, i) => (
          <Reveal key={clip.title} delay={i * 0.08}>
            <ClipHoverCard
              title={clip.title}
              who={clip.who}
              date={clip.date}
              videoSrc={clip.videoSrc}
              mediaClassName="h-[436px] w-full"
            />
          </Reveal>
        ))}
      </div>

    </section>
  );
}
