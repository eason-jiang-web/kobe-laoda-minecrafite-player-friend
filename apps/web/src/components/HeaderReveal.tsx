"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

type HeaderRevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  stagger?: number;
  as?: keyof JSX.IntrinsicElements;
};

export function HeaderReveal({
  children,
  className = "",
  delay = 0,
  duration = 0.8,
  stagger = 0.08,
  as: Tag = "h2",
}: HeaderRevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { visibility: "visible", opacity: 1 });
      return;
    }

    let split: SplitText | null = null;
    let tween: gsap.core.Tween | null = null;
    let trigger: ScrollTrigger | null = null;
    let played = false;
    let cancelled = false;

    const ctx = gsap.context(() => {
      gsap.set(el, { visibility: "hidden", opacity: 1 });
    }, ref);

    const play = () => {
      if (played) return;
      played = true;
      tween?.play(0);
    };

    const setup = () => {
      if (cancelled) return;

      ctx.add(() => {
        gsap.set(el, { visibility: "visible", opacity: 1 });

        split = SplitText.create(el, {
          type: "words,lines",
          linesClass: "split-line",
          autoSplit: true,
          mask: "lines",
          onSplit: (self) => {
            tween?.kill();
            gsap.set(self.lines, { yPercent: 100, willChange: "transform" });

            tween = gsap.to(self.lines, {
              yPercent: 0,
              duration,
              delay,
              stagger,
              ease: "expo.out",
              paused: true,
              overwrite: true,
              onComplete: () => gsap.set(self.lines, { willChange: "auto" }),
            });

            if (played) tween.progress(1);
            return tween;
          },
        });

        trigger = ScrollTrigger.create({
          trigger: el,
          start: "top bottom",
          once: true,
          onEnter: play,
          onRefresh: () => {
            if (el.getBoundingClientRect().top < window.innerHeight) {
              play();
            }
          },
        });

        if (el.getBoundingClientRect().top < window.innerHeight) {
          play();
        }
      });
    };

    const fallback = window.setTimeout(() => {
      if (!played) {
        gsap.set(el, { visibility: "visible" });
        play();
      }
    }, 2200);

    document.fonts?.ready.then(setup);

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      trigger?.kill();
      tween?.kill();
      split?.revert();
      ctx.revert();
    };
  }, [delay, duration, stagger]);

  const Component = Tag as React.ElementType;
  return (
    <Component
      ref={ref}
      className={className}
      style={{ visibility: "hidden", opacity: 1 }}
    >
      {children}
    </Component>
  );
}
