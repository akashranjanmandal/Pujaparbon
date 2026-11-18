import type { Config } from "tailwindcss";

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

/**
 * Pujo Parbon design tokens — warm paper, powder blue (primary), soft lavender (secondary), sunset peach (accent).
 * Legacy aliases stay so every screen re-themes from here:
 *   sindoor = alert red · gold = ink (high-contrast) · marigold = warning · leaf = success · sky = primary · stem = peach
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: c("bg"), bg2: c("bg2"), panel: c("panel"), panel2: c("panel2"), line: c("line"), text: c("text"), muted: c("muted"),
        primary: c("primary"), "primary-soft": c("primary-soft"), "primary-tint": c("primary-tint"),
        lav: c("lav"), "lav-soft": c("lav-soft"), "lav-tint": c("lav-tint"),
        peach: c("peach"), "peach-soft": c("peach-soft"), "peach-tint": c("peach-tint"),
        sindoor: c("sindoor"), "sindoor-deep": c("sindoor-deep"), accent: c("primary"),
        gold: c("text"), marigold: c("marigold"), shiuli: c("panel"), stem: c("peach"), leaf: c("leaf"), sky: c("primary"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: {
        glow: "0 1px 2px rgb(var(--line) / 0.05), 0 12px 32px -16px rgb(var(--line) / 0.18)",
        soft: "0 1px 2px rgb(var(--line) / 0.04), 0 6px 20px -12px rgb(var(--line) / 0.14)",
        lift: "0 2px 4px rgb(var(--line) / 0.04), 0 24px 48px -20px rgb(var(--line) / 0.25)",
        diya: "0 0 0 4px rgb(var(--primary) / 0.18)",
        accent: "0 8px 24px -10px rgb(var(--primary) / 0.6)",
      },
      keyframes: {
        dhak: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
        spinslow: { to: { transform: "rotate(360deg)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        radar: { "0%": { transform: "scale(0.2)", opacity: "0.9" }, "100%": { transform: "scale(1)", opacity: "0" } },
        scan: { "0%": { transform: "translateY(-100%)" }, "100%": { transform: "translateY(100%)" } },
        flow: { to: { strokeDashoffset: "-24" } },
        marquee: { to: { transform: "translateX(-50%)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
      },
      animation: {
        dhak: "dhak 1.4s ease-in-out infinite",
        spinslow: "spinslow 60s linear infinite",
        shimmer: "shimmer 2s linear infinite",
        radar: "radar 2.4s cubic-bezier(.2,.6,.3,1) infinite",
        scan: "scan 3.5s linear infinite",
        flow: "flow 1.2s linear infinite",
        marquee: "marquee 40s linear infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
