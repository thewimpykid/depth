"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "home" },
  { href: "/events", label: "events" },
  { href: "/matches", label: "matches" },
  { href: "/teams", label: "teams" },
  { href: "/compare", label: "compare" },
  { href: "/simulate", label: "simulate" },
  { href: "/season-records", label: "season records" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070707]/94 backdrop-blur">
      <div className="mx-auto max-w-6xl px-5 py-4 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="inline-flex w-fit items-center rounded-[10px] border border-white/10 bg-[#111111] px-4 py-2 text-base font-medium tracking-[-0.04em] text-white"
          >
            depth
          </Link>

          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="site-nav-mobile"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-white/10 bg-[#0d0d0d] text-white md:hidden"
          >
            <span className="relative h-4 w-5">
              <span
                className={[
                  "absolute left-0 top-0 h-[1.5px] w-5 bg-current transition-transform duration-200",
                  menuOpen ? "translate-y-[7px] rotate-45" : "",
                ].join(" ")}
              />
              <span
                className={[
                  "absolute left-0 top-[7px] h-[1.5px] w-5 bg-current transition-opacity duration-200",
                  menuOpen ? "opacity-0" : "opacity-100",
                ].join(" ")}
              />
              <span
                className={[
                  "absolute left-0 top-[14px] h-[1.5px] w-5 bg-current transition-transform duration-200",
                  menuOpen ? "-translate-y-[7px] -rotate-45" : "",
                ].join(" ")}
              />
            </span>
          </button>

          <nav
            id="site-nav"
            className="hidden flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] md:flex"
          >
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "rounded-[10px] border px-4 py-2.5 transition-colors",
                    active
                      ? "border-white/18 bg-white text-black"
                      : "border-white/10 bg-[#0d0d0d] text-white/62 hover:text-white",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <nav
          id="site-nav-mobile"
          className={[
            "overflow-hidden transition-[max-height,opacity,margin] duration-200 md:hidden",
            menuOpen ? "mt-4 max-h-[30rem] opacity-100" : "mt-0 max-h-0 opacity-0",
          ].join(" ")}
        >
          <div className="grid gap-2 rounded-[12px] border border-white/10 bg-[#090909] p-3 text-[11px] uppercase tracking-[0.18em]">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    "rounded-[10px] border px-4 py-3 transition-colors",
                    active
                      ? "border-white/18 bg-white text-black"
                      : "border-white/10 bg-[#0d0d0d] text-white/62 hover:text-white",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
