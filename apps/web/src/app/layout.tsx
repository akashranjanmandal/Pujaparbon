import type { Metadata, Viewport } from "next";
import { Geist_Mono, Lexend } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

/** Lexend: designed for reading ease — wide letterforms, large x-height, readable from a distance. */
const sans = Lexend({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Puja Parbon — Fulfilment for online sellers", template: "%s · Puja Parbon" },
  description: "Puja Parbon stores, packs and ships orders for sellers on Flipkart, Amazon, Myntra, Meesho and Ajio — with a live dashboard for every seller.",
};
export const viewport: Viewport = { themeColor: "#FAF7F2", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
