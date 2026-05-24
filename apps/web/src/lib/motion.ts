// Easing curves. The CDP capture fired 0 discrete animations (common for Framer
// motion/react sites), so motion-specs.md degraded to generic defaults. These are
// the de-facto Framer expo curves the source's framer-motion would have used —
// tune against the live site during the verify pass.
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;
export const easeOutQuint = [0.22, 1, 0.36, 1] as const;
export const easeInOutQuart = [0.77, 0, 0.175, 1] as const;

// CSS cubic-bezier strings for plain transitions / GSAP.
export const cssEaseOutExpo = "cubic-bezier(0.16, 1, 0.3, 1)";
export const cssEaseOutQuint = "cubic-bezier(0.22, 1, 0.36, 1)";

// Standard reveal timings (PLAYBOOK framer-tier defaults).
export const reveal = {
  duration: 1.0, // hero/section reveal: 0.8–1.2s
  stagger: 0.12, // word/line stagger: 0.1–0.15
} as const;
