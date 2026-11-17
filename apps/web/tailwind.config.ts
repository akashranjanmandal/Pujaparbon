import type { Config } from "tailwindcss";

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

/**
 * Mission Control design tokens.
 * Legacy token names are kept as semantic aliases so every screen re-themes from one place:
 *   sindoor = brand accent (Puja Parbon red) · gold = high-contrast highlight · marigold = warning
 *   leaf = success · sky = info · stem = secondary signal (orange) · shiuli = pure white
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: c("bg"), bg2: c("bg2"), panel: c("panel"), panel2: c("panel2"), line: c("line"),
        text: c("text"), muted: c("muted"), sindoor: c("sindoor"), "sindoor-deep": c("sindoor-deep"),
        accent: c("sindoor"), gold: c("gold"), marigold: c("marigold"), shiuli: c("shiuli"), stem: c("stem"), leaf: c("leaf"), sky: c("sky"),
      },
      fontFamily: {
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { xl2: "0.875rem" },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--line) / 0.10), 0 8px 32px -12px rgb(0 0 0 / 0.6)",
        diya: "0 0 0 4px rgb(var(--sindoor) / 0.18), 0 0 24px rgb(var(--sindoor) / 0.35)",
        lift: "0 24px 60px -24px rgb(0 0 0 / 0.65)",
        accent: "0 0 0 1px rgb(var(--sindoor) / 0.5), 0 8px 28px -8px rgb(var(--sindoor) / 0.55)",
      },
      keyframes: {
        dhak: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
        spinslow: { to: { transform: "rotate(360deg)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        radar: { "0%": { transform: "scale(0.2)", opacity: "0.9" }, "100%": { transform: "scale(1)", opacity: "0" } },
        scan: { "0%": { transform: "translateY(-100%)" }, "100%": { transform: "translateY(100%)" } },
        flow: { to: { strokeDashoffset: "-24" } },
      },
      animation: {
        dhak: "dhak 1.4s ease-in-out infinite",
        spinslow: "spinslow 60s linear infinite",
        shimmer: "shimmer 2s linear infinite",
        radar: "radar 2.4s cubic-bezier(.2,.6,.3,1) infinite",
        scan: "scan 3.5s linear infinite",
        flow: "flow 1.2s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
