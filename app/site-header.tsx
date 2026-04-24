"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import SmartSearchInput from "./smart-search-input";
import ThemeToggle from "./theme-toggle";
import type { SearchSuggestion } from "@/lib/smart-search";

const NAV_ITEMS = [
  { href: "/", label: "home" },
  { href: "/events", label: "events" },
  { href: "/matches", label: "matches" },
  { href: "/teams", label: "teams" },
  { href: "/compare", label: "compare" },
  { href: "/simulate", label: "simulate" },
  { href: "/scouting", label: "scout" },
  { href: "/methodology", label: "methodology" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader({ season }: { season: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  function handlePick(suggestion: SearchSuggestion) {
    setSearchQuery("");
    if (suggestion.type === "team" && suggestion.teamNumber) {
      router.push(`/teams?q=${suggestion.teamNumber}&season=${season}`);
    } else if (suggestion.type === "event" && suggestion.eventCode) {
      const s = suggestion.season ?? season;
      router.push(`/matches?eventCode=${encodeURIComponent(suggestion.eventCode)}&season=${s}&eventQuery=${encodeURIComponent(suggestion.title)}`);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070707]/94 backdrop-blur">
      <div className="mx-auto max-w-7xl px-5 py-3 sm:px-8">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="shrink-0 inline-flex items-center rounded-[10px] border border-white/10 bg-[#111111] px-3.5 py-2 text-sm font-medium tracking-[-0.04em] text-white"
          >
            depth
          </Link>

          {/* Desktop nav */}
          <nav className="hidden flex-1 flex-wrap items-center gap-1 text-[10px] uppercase tracking-[0.16em] md:flex">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "rounded-[8px] border px-3 py-2 transition-colors",
                    active
                      ? "border-white/18 bg-white text-black font-semibold"
                      : "border-transparent text-white/52 hover:text-white/80",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop search */}
          <div className="hidden md:block w-52 shrink-0">
            <SmartSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              onPick={handlePick}
              scope="mixed"
              season={season}
              placeholder="Search teams or events"
              containerClassName="h-9 rounded-[10px] border border-white/10 bg-[#0d0d0d] text-sm focus-within:border-white/25"
            />
          </div>

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Mobile hamburger */}
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="site-nav-mobile"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-[#0d0d0d] text-white md:hidden"
          >
            <span className="relative h-4 w-5">
              <span className={["absolute left-0 top-0 h-[1.5px] w-5 bg-current transition-transform duration-200", menuOpen ? "translate-y-[7px] rotate-45" : ""].join(" ")} />
              <span className={["absolute left-0 top-[7px] h-[1.5px] w-5 bg-current transition-opacity duration-200", menuOpen ? "opacity-0" : "opacity-100"].join(" ")} />
              <span className={["absolute left-0 top-[14px] h-[1.5px] w-5 bg-current transition-transform duration-200", menuOpen ? "-translate-y-[7px] -rotate-45" : ""].join(" ")} />
            </span>
          </button>
        </div>

        {/* Mobile menu */}
        <nav
          id="site-nav-mobile"
          className={["overflow-hidden transition-[max-height,opacity,margin] duration-200 md:hidden", menuOpen ? "mt-3 max-h-[30rem] opacity-100" : "mt-0 max-h-0 opacity-0"].join(" ")}
        >
          <div className="rounded-[12px] border border-white/10 bg-[#090909] p-2">
            {/* Mobile search */}
            <div className="mb-2">
              <SmartSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                onPick={(suggestion) => { setMenuOpen(false); handlePick(suggestion); }}
                scope="mixed"
                season={season}
                placeholder="Search teams or events"
                containerClassName="h-11 rounded-[10px] border border-white/10 bg-[#0d0d0d] text-sm focus-within:border-white/25"
              />
            </div>
            <div className="grid gap-1 text-[10px] uppercase tracking-[0.16em]">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={["rounded-[8px] border px-4 py-3 transition-colors", active ? "border-white/18 bg-white text-black font-semibold" : "border-transparent text-white/52 hover:text-white/80"].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
