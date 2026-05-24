"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll-reveal wrapper. Uses IntersectionObserver (not a scroll listener) so it
 * fires reliably under Playwright/headed capture — a port gotcha called out in
 * PLAYBOOK §5. Holds opacity at 0.001 (not 0) to keep the GPU compositing layer
 * alive, matching Framer's own trick and avoiding a paint pop on reveal.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  y = 24,
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

    const show = () => {
      el.style.transitionDelay = `${delay}s`;
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    };

    // Reduced motion: show instantly, no slide.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.transition = "none";
      show();
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          show();
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "-8% 0px" },
    );
    io.observe(el);

    // Safety net: never leave content permanently invisible if IO never fires.
    const fallback = window.setTimeout(show, 2500);

    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, [delay]);

  const Component = Tag as React.ElementType;
  return (
    <Component
      ref={ref}
      className={className}
      style={{
        opacity: 0.001,
        transform: `translateY(${y}px)`,
        transition: "opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1)",
        willChange: "opacity, transform",
      }}
    >
      {children}
    </Component>
  );
}
