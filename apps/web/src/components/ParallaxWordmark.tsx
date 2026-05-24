"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { wordmark } from "@/lib/content";

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
  const dot = useRef<HTMLSpanElement>(null);
  const right = useRef<HTMLSpanElement>(null);
  const registered = useRef<HTMLSpanElement>(null);

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
        .fromTo([left.current, dot.current], { xPercent: -40 }, { xPercent: 0, ease: "none" }, 0)
        .fromTo([right.current, registered.current], { xPercent: 40 }, { xPercent: 0, ease: "none" }, 0);
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={root}
      className="relative h-full w-full leading-none text-white"
    >
      <span
        ref={left}
        data-wordmark-part="left"
        className="absolute left-5 top-0 font-display text-[160px] font-light leading-[0.8] tracking-normal"
      >
        {wordmark[0]}
      </span>
      <span
        ref={dot}
        data-wordmark-part="dot"
        className="absolute left-[360px] top-0 font-display text-[160px] font-light leading-[0.8] tracking-normal"
      >
        .
      </span>
      <span
        ref={right}
        data-wordmark-part="right"
        className="absolute left-1/2 top-0 font-display text-[160px] font-light leading-[0.8] tracking-normal"
      >
        {wordmark[1]}
      </span>
      <span
        ref={registered}
        data-wordmark-part="registered"
        className="absolute right-5 top-0 font-display text-[160px] font-light leading-[0.8] tracking-normal"
      >
        ®
      </span>
    </div>
  );
}
