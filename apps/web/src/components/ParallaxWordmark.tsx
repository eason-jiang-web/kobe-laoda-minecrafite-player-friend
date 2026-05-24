"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { wordmark } from "@/lib/content";
import { Arrow } from "@/components/Arrow";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * The closing wordmark — source splits "WA · CO ®" across the bottom of the final
 * banner with the halves on a parallax (the capture flagged these as `parallax`
 * entering elements). Here "it · to ®". The two halves drift in from opposite
 * sides as the banner scrolls through, scrubbed to scroll progress.
 */
export function ParallaxWordmark() {
  const root = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLSpanElement>(null);
  const right = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tween = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top bottom",
          end: "bottom bottom",
          scrub: true,
        },
      });
      tween
        .fromTo(left.current, { xPercent: -40, opacity: 0.3 }, { xPercent: 0, opacity: 1, ease: "none" }, 0)
        .fromTo(right.current, { xPercent: 40, opacity: 0.3 }, { xPercent: 0, opacity: 1, ease: "none" }, 0);
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={root}
      className="flex w-full items-end justify-between leading-none text-white"
    >
      <span
        ref={left}
        className="font-display text-display font-light leading-[0.8] tracking-tightest"
      >
        {wordmark[0]}
      </span>
      <span
        ref={right}
        className="flex items-start font-display text-display font-light leading-[0.8] tracking-tightest"
      >
        {wordmark[1]}
        <sup className="ml-2 mt-3 text-2xl md:text-4xl">®</sup>
      </span>
      <Arrow className="absolute right-[10px] top-[14px] h-10 w-10 text-white md:right-5 md:top-5 md:h-16 md:w-16" />
    </div>
  );
}
