import type { Config } from "tailwindcss";

// Theme seeded from the wideangles capture (reference/wideangles/tokens).
// Editorial film-portfolio system reskinned for itto: white canvas, black ink,
// one muted grey for secondary labels. Switzer = display, Manrope = headings/body,
// Martian Mono = micro-labels.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    // Source uses 2 breakpoints, not 3 — don't invent a tablet bp (PLAYBOOK rule).
    screens: {
      md: "810px",
      lg: "1200px",
    },
    extend: {
      colors: {
        ink: "rgb(0, 0, 0)",
        canvas: "rgb(255, 255, 255)",
        // #aeaca8 — the muted grey for secondary/meta labels (used 38× in source)
        muted: "rgb(174, 172, 168)",
      },
      fontFamily: {
        display: ["Switzer", "sans-serif"],
        sans: ["Manrope", "sans-serif"],
        mono: ['"Martian Mono"', "monospace"],
      },
      fontSize: {
        // measured from the capture
        label: ["11px", { lineHeight: "1.3", letterSpacing: "0.02em" }],
        meta: ["12px", { lineHeight: "1.4" }],
        h2: ["24px", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        display: ["clamp(64px, 14vw, 200px)", { lineHeight: "0.9", letterSpacing: "-0.03em" }],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
    },
  },
  plugins: [],
};

export default config;
