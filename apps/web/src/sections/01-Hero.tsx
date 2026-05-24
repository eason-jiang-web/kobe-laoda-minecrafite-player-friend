"use client";

import { HoverLink } from "@/components/HoverLink";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { brand } from "@/lib/content";

/**
 * 01 — Hero. Full-bleed cinematic background. The screen recording plays once,
 * then the generated hero loop fades in and repeats forever.
 *
 * Intro is a GSAP timeline, sequenced: (1) the itto logo scales in cleanly,
 * THEN (2) the whole frame racks into focus like a camera (uniform blur pull
 * + brightness + a subtle lens-breath), then (3) the edge labels resolve in.
 */
export function Hero() {
  const [phase, setPhase] = useState<"intro" | "loop">("intro");
  const loopRef = useRef<HTMLVideoElement>(null);

  const rootRef = useRef<HTMLElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (reduce) {
        gsap.set(logoRef.current, { opacity: 1, scale: 1 });
        gsap.set(focusRef.current, { "--fb": "0px", "--fbr": "1", scale: 1 });
        gsap.set([labelsRef.current, cueRef.current], { opacity: 1 });
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.set(logoRef.current, { opacity: 0, scale: 0.82, transformOrigin: "50% 50%" })
        .set(focusRef.current, {
          "--fb": "24px",
          "--fbr": "0.68",
          scale: 1.06,
          transformOrigin: "50% 50%",
        })
        .set([labelsRef.current, cueRef.current], { opacity: 0 })

        // 1 — logo scales in cleanly (no bounce / overshoot)
        .to(logoRef.current, {
          opacity: 1,
          scale: 1,
          duration: 0.7,
          ease: "power3.out",
        }, 0.2)

        // 2 — THEN the frame racks into focus: uniform blur pull + lens-breath
        .to(focusRef.current, {
          "--fb": "0px",
          "--fbr": "1",
          scale: 1,
          duration: 1.5,
          ease: "power2.inOut",
        }, ">0.12")

        // 3 — edge labels resolve as focus locks
        .to([labelsRef.current, cueRef.current], {
          opacity: 1,
          duration: 1.0,
          stagger: 0.15,
        }, "<0.45");
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="hero"
      ref={rootRef}
      className="relative h-[100svh] w-full overflow-hidden bg-ink"
    >
      <h1 className="sr-only">
        itto is an ai minecraft co-op buddy that joins your world, follows you,
        helps with tasks, remembers your world, and hangs in your discord call.
      </h1>
      {/* focus wrapper: uniform blur + brightness racked by GSAP (--fb / --fbr) */}
      <div
        ref={focusRef}
        className="absolute inset-0 will-change-[filter,transform]"
        style={{ filter: "blur(var(--fb, 24px)) brightness(var(--fbr, 0.68))" }}
      >
        <video
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out"
          style={{ opacity: phase === "intro" ? 1 : 0 }}
          src="/video/hero-screen-recording.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={() => {
            setPhase("loop");
            void loopRef.current?.play();
          }}
        />
        <video
          ref={loopRef}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out"
          style={{ opacity: phase === "loop" ? 1 : 0 }}
          src="/video/hero-loop.mp4"
          muted
          loop
          playsInline
          preload="auto"
        />
      </div>

      <div className="absolute inset-0 bg-black/20" />

      {/* centered logo + blinking wordmark underscore — scales in first */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          ref={logoRef}
          className="relative w-[clamp(240px,28vw,400px)] drop-shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
          style={{ opacity: 0 }}
        >
          <img src="/itto-logo.png" alt="itto" className="block w-full" />
          <img
            src="/itto-underscore.png"
            alt=""
            aria-hidden
            className="blink absolute"
            style={{ left: "70.72%", top: "95.35%", width: "6.51%" }}
          />
        </div>
      </div>

      {/* center mid labels — resolve in as focus locks */}
      <div
        ref={labelsRef}
        className="absolute inset-0 flex items-center justify-between px-[10px] text-white md:px-5"
        style={{ opacity: 0 }}
      >
        <span className="u-label max-w-[140px]">{brand.tagline}</span>
        <span className="u-label max-w-[140px] text-right">spawns next to you</span>
      </div>

      {/* scroll cue */}
      <div
        ref={cueRef}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white"
        style={{ opacity: 0 }}
      >
        <HoverLink href="#clips" className="u-label pointer-events-auto">
          scroll down
        </HoverLink>
      </div>
    </section>
  );
}
