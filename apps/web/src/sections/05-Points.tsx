"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { HeaderReveal } from "@/components/HeaderReveal";
import { points } from "@/lib/content";
import { Reveal } from "@/components/Reveal";

/**
 * 05 — Points. Desktop source geometry: 643px tall, centered headline at the
 * top, two mono text blocks across the middle, and a 400x242 horizontal media
 * belt clipped across the bottom.
 */
export function Points() {
  const root = useRef<HTMLElement>(null);
  const belt = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = belt.current;
    if (!track) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(track, { x: -418 });
      return;
    }

    const ctx = gsap.context(() => {
      const wrapX = gsap.utils.wrap(-818, -418);

      gsap.set(track, { x: -418, willChange: "transform" });
      gsap.to(track, {
        x: "-=400",
        duration: 3.9,
        ease: "none",
        repeat: -1,
        modifiers: {
          x: (value) => `${wrapX(parseFloat(value))}px`,
        },
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={root}
      id="points"
      className="relative h-auto overflow-hidden bg-canvas px-[10px] pb-[242px] pt-24 md:h-[643px] md:px-5 md:pb-0"
    >
      <div className="mx-auto max-w-[550px] text-center">
        <HeaderReveal className="font-sans text-[24px] font-medium uppercase leading-none text-ink">
          {points.manifesto}
        </HeaderReveal>
      </div>

      <div className="mt-20 grid grid-cols-1 gap-10 md:absolute md:left-5 md:right-5 md:top-[244px] md:mt-0 md:flex md:justify-between">
        <Reveal className="max-w-[420px]">
          <p className="u-label mb-6 text-muted">{points.left.head}</p>
          <p className="u-label text-ink">{points.left.body}</p>
        </Reveal>
        <Reveal delay={0.08} className="max-w-[420px] md:text-right">
          <p className="u-label mb-6 text-muted">{points.right.head}</p>
          <p className="u-label text-ink">{points.right.body}</p>
        </Reveal>
      </div>

      <div className="absolute bottom-0 left-0 h-[242px] w-full overflow-hidden">
        <div
          ref={belt}
          data-points-belt=""
          className="flex h-full"
          style={{ transform: "translateX(-418px)" }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <video
              key={i}
              data-points-tile=""
              className="h-[242px] w-[400px] shrink-0 object-cover"
              src="/video/hero.mp4"
              autoPlay
              muted
              loop
              playsInline
            />
          ))}
        </div>
      </div>
    </section>
  );
}
