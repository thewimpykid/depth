"use client";

import { useEffect, useState } from "react";

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className="h-4 w-4">
      <circle cx="10" cy="10" r="3.5" />
      <line x1="10" y1="1.5" x2="10" y2="3.5" />
      <line x1="10" y1="16.5" x2="10" y2="18.5" />
      <line x1="1.5" y1="10" x2="3.5" y2="10" />
      <line x1="16.5" y1="10" x2="18.5" y2="10" />
      <line x1="4.1" y1="4.1" x2="5.5" y2="5.5" />
      <line x1="14.5" y1="14.5" x2="15.9" y2="15.9" />
      <line x1="15.9" y1="4.1" x2="14.5" y2="5.5" />
      <line x1="5.5" y1="14.5" x2="4.1" y2="15.9" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className="h-4 w-4">
      <path d="M15.5 11A6.5 6.5 0 0 1 9 4.5 6.5 6.5 0 0 0 10 17a6.5 6.5 0 0 0 5.5-6z" />
    </svg>
  );
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(current === "light" ? "light" : "dark");
    setMounted(true);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("depth-theme", next); } catch {}
  }

  if (!mounted) return <div className="h-9 w-9" />;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-[#0d0d0d] text-white/62 transition-colors hover:text-white/90"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
