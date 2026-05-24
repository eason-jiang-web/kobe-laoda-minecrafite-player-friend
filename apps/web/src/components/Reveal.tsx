"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Scroll-reveal wrapper — matches the measured wideangles entrance behavior:
 * transform-only translateY(20px|60px) -> 0, opacity held at 1.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  y = 20,
  as: Tag = "div",
}: {
  children?: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: keyof JSX.IntrinsicElements;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { y: 0, clearProps: "willChange" });
      return;
    }

    let played = false;
    const ctx = gsap.context(() => {
      gsap.set(el, { y, opacity: 1, willChange: "transform" });

      const tween = gsap.to(el, {
        y: 0,
        duration: 0.9,
        delay,
        ease: "expo.out",
        paused: true,
        overwrite: true,
        onComplete: () => gsap.set(el, { willChange: "auto" }),
      });

      const play = () => {
        if (played) return;
        played = true;
        tween.play(0);
      };

      ScrollTrigger.create({
        trigger: el,
        start: "top bottom",
        once: true,
        onEnter: play,
        onRefresh: (self) => {
          if (self.isActive || el.getBoundingClientRect().top < window.innerHeight) {
            play();
          }
        },
      });

      if (el.getBoundingClientRect().top < window.innerHeight) {
        play();
      }
    }, ref);

    const fallback = window.setTimeout(() => {
      if (!played) {
        gsap.to(el, { y: 0, duration: 0.6, ease: "expo.out" });
      }
    }, 2000);

    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    return () => {
      window.clearTimeout(fallback);
      ctx.revert();
    };
  }, [delay, y]);

  const Component = Tag as React.ElementType;
  return (
    <Component
      ref={ref}
      className={className}
      style={{
        transform: `translateY(${y}px)`,
        opacity: 1,
        willChange: "transform",
      }}
    >
      {children}
    </Component>
  );
}
