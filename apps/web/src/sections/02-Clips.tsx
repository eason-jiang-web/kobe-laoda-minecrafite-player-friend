"use client";

import { clips } from "@/lib/content";
import { ClipHoverCard } from "@/components/ClipHoverCard";
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
        <h2 className="font-display text-[160px] font-light uppercase leading-[0.8] tracking-normal text-ink">
          clips
        </h2>
        <span className="font-display text-[160px] font-light leading-[0.8] tracking-normal text-ink">
          {clips.length}
        </span>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2">
        {featureClips.map((clip, i) => (
          <Reveal key={clip.title} delay={i * 0.08}>
            <ClipHoverCard
              title={clip.title}
              who={clip.who}
              date={clip.date}
              mediaClassName="h-[436px] w-full"
            />
          </Reveal>
        ))}
      </div>

      <div className="mt-[52px] grid grid-cols-1 md:grid-cols-3">
        {smallClips.map((clip, i) => (
          <Reveal key={clip.title} delay={i * 0.06}>
            <ClipHoverCard
              title={clip.title}
              who={clip.who}
              date={clip.date}
              mediaClassName="h-[291px] w-full"
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
