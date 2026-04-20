import { Suspense } from "react";
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

async function AsyncHeader() {
  "use cache";
  cacheLife("days");
  const { currentSeason } = await getCurrentSeasonWithOptions().catch(() => ({
    currentSeason: 2024,
    seasonOptions: [] as number[],
  }));
  return <SiteHeader season={currentSeason} />;
}

function HeaderFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070707]/94 backdrop-blur">
      <div className="mx-auto max-w-7xl px-5 py-3 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="shrink-0 inline-flex items-center rounded-[10px] border border-white/10 bg-[#111111] px-3.5 py-2 text-sm font-medium tracking-[-0.04em] text-white">
            depth
          </span>
        </div>
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        <Suspense fallback={<HeaderFallback />}>
          <AsyncHeader />
        </Suspense>
        <div className="flex-1">{children}</div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
