import type { Metadata, Viewport } from "next";
import { Fraunces, Hind_Siliguri, Tiro_Bangla } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["SOFT", "opsz"] });
const body = Hind_Siliguri({ subsets: ["latin", "bengali"], weight: ["300", "400", "500", "600", "700"], variable: "--font-body", display: "swap" });
const bangla = Tiro_Bangla({ subsets: ["bengali", "latin"], weight: "400", variable: "--font-bangla", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Puja Parbon · Seller OS", template: "%s · Puja Parbon" },
  description: "Warehouse, multi-marketplace orders, GST billing and team management for Puja Parbon. Built by GOBT.",
};
export const viewport: Viewport = { themeColor: "#0c0608", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="sandhya" className={`${display.variable} ${body.variable} ${bangla.variable}`} suppressHydrationWarning>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
