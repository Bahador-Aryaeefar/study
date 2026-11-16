"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PHASE_META, TRACKS, TrackId, phases, trackFromPath } from "@/lib/roadmap";
import { overallProgress, useProgress } from "@/lib/progress";

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  }, []);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("ai-roadmap-theme", next); } catch { /* ignore */ }
  };
  return (
    <button className="themebtn" onClick={flip} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title={theme === "dark" ? "Light theme" : "Dark theme (easier on the eyes at night)"}>
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

export default function SiteNav() {
  const { done, saveState } = useProgress();
  const path = usePathname();
  const track = trackFromPath(path);
  const pct = overallProgress(done, track);
  const current = phases.find((p) => path === `/phase/${p.id}`);
  return (
    <nav className="sitenav">
      <div className="sitenav-in">
        <Link href="/" className="brand">
          <span className="brand-dot" /> Study Roadmap
        </Link>
        <span className="tracks">
          {(Object.keys(TRACKS) as TrackId[]).map((t) => (
            <Link key={t} href={TRACKS[t].href} className={t === track ? "on" : ""} aria-current={t === track ? "page" : undefined}>{TRACKS[t].nav}</Link>
          ))}
        </span>
        {current && (
          <span className="crumb">
            <span aria-hidden>›</span> {PHASE_META[current.id]?.icon} {current.title}
          </span>
        )}
        <span className="sp" />
        <span className={`navsave save-${saveState}`} title="Progress save status"><span className="dot" />{saveState === "file" ? "Saved" : saveState === "saving" ? "Saving…" : saveState === "browser" ? "Local only" : "…"}</span>
        <ThemeToggle />
        <span className="navpct" title="Progress in this track">
          <i style={{ width: `${pct}%` }} />
          <b>{pct}%</b>
        </span>
      </div>
    </nav>
  );
}
