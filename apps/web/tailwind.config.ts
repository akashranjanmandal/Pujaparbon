import type { Config } from "tailwindcss";

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="sandhya"]'],
  theme: {
    extend: {
      colors: {
        bg: c("bg"), bg2: c("bg2"), panel: c("panel"), panel2: c("panel2"), line: c("line"),
        text: c("text"), muted: c("muted"), sindoor: c("sindoor"), "sindoor-deep": c("sindoor-deep"),
        gold: c("gold"), marigold: c("marigold"), shiuli: c("shiuli"), stem: c("stem"), leaf: c("leaf"), sky: c("sky"),
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        bangla: ["var(--font-bangla)", "var(--font-body)", "serif"],
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--gold) / 0.12), 0 8px 40px -12px rgb(var(--sindoor) / 0.35)",
        diya: "0 0 24px 2px rgb(var(--marigold) / 0.45)",
        lift: "0 24px 60px -24px rgb(0 0 0 / 0.55)",
      },
      keyframes: {
        flicker: { "0%,100%": { transform: "scale(1) rotate(-2deg)", opacity: "1" }, "40%": { transform: "scale(1.06,0.94) rotate(2deg)", opacity: "0.9" }, "70%": { transform: "scale(0.96,1.05) rotate(-1deg)" } },
        dhak: { "0%,100%": { transform: "scale(1)", opacity: "1" }, "10%": { transform: "scale(1.5)", opacity: "0.6" }, "20%": { transform: "scale(1)" }, "30%": { transform: "scale(1.35)", opacity: "0.7" }, "40%": { transform: "scale(1)", opacity: "1" } },
        spinslow: { to: { transform: "rotate(360deg)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        rise: { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        radar: { "0%": { transform: "scale(0.2)", opacity: "0.9" }, "100%": { transform: "scale(1)", opacity: "0" } },
      },
      animation: {
        flicker: "flicker 2.4s ease-in-out infinite",
        dhak: "dhak 1.6s ease-in-out infinite",
        spinslow: "spinslow 90s linear infinite",
        shimmer: "shimmer 2.2s linear infinite",
        rise: "rise .6s cubic-bezier(.2,.8,.2,1) both",
        radar: "radar 2.4s cubic-bezier(.2,.6,.3,1) infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
