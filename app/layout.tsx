import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { cacheLife } from "next/cache";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import SiteHeader from "./site-header";
import "./globals.css";
import { getCurrentSeasonWithOptions } from "@/lib/team-analysis";

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const bodyFont = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "depth",
  description: "FTC team events, matches, and OPR.",
};

const themeScript = `(function(){try{var t=localStorage.getItem('depth-theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  "use cache";
  cacheLife("days");
  const { currentSeason } = await getCurrentSeasonWithOptions().catch(() => ({ currentSeason: 2024, seasonOptions: [] as number[] }));

  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-[#050505]">
        <SiteHeader season={currentSeason} />
        <div className="flex-1">{children}</div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
