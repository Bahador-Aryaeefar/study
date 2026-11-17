"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface TocItem { id: string; label: string; sub?: boolean }

const offset = () => {
  const nav = document.querySelector(".sitenav") as HTMLElement | null;
  return (nav?.offsetHeight ?? 60) + 16;
};

/** Table of contents with working jump links and a scroll-spy highlight. */
export default function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  const lock = useRef(0);
  const key = items.map((i) => i.id).join(",");
  const listRef = useRef<HTMLUListElement>(null);

  // scroll-spy: the active item is the last section whose top has passed the header
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const compute = () => {
      timer = undefined;
      if (Date.now() < lock.current) return;
      const line = offset() + 8;
      let cur = items[0]?.id ?? "";
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) cur = it.id;
        else break;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = items[items.length - 1]?.id ?? cur;
      // update the DOM immediately (works even when React rendering is throttled), then sync state
      listRef.current?.querySelectorAll("li").forEach((li) => li.classList.toggle("active", (li as HTMLElement).dataset.id === cur));
      setActive(cur);
    };
    let last = 0;
    const onScroll = () => {
      const now = Date.now();
      if (now - last > 60) { last = now; compute(); }
      else if (timer === undefined) timer = setTimeout(() => { last = Date.now(); compute(); }, 60);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (timer !== undefined) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const set = () => document.documentElement.style.setProperty("--nav-h", `${(document.querySelector(".sitenav") as HTMLElement | null)?.offsetHeight ?? 60}px`);
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);

  // keep the active entry visible inside the (scrollable) sidebar
  useEffect(() => {
    const li = listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(active)}"]`);
    const box = listRef.current?.parentElement;
    if (li && box) {
      const t = li.offsetTop, b = t + li.offsetHeight;
      if (t < box.scrollTop + 40) box.scrollTop = Math.max(0, t - 60);
      else if (b > box.scrollTop + box.clientHeight - 20) box.scrollTop = b - box.clientHeight + 60;
    }
  }, [active]);

  const go = useCallback((id: string) => {
    const jump = () => {
      const el = document.getElementById(id);
      if (!el) return;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset(), behavior: "instant" as ScrollBehavior });
    };
    setActive(id);
    setOpen(false);
    lock.current = Date.now() + 700;
    jump();
    // lazily mounted labs change heights while we land - re-aim a few times
    [60, 200, 450].forEach((ms) => setTimeout(jump, ms));
    try { history.replaceState(null, "", `#${id}`); } catch { /* ignore */ }
  }, []);

  return (
    <>
      <button type="button" className="toc-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="toc-toggle-k">Section</span>
        <span className="toc-toggle-v">{items.find((i) => i.id === active)?.label ?? "Sections"}</span>
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
    <ul ref={listRef} className={open ? "open" : ""}>
      {items.map((x) => (
        <li key={x.id} data-id={x.id} className={`${x.sub ? "sub" : ""} ${active === x.id ? "active" : ""}`}>
          <a href={`#${x.id}`} aria-current={active === x.id ? "location" : undefined} onClick={(e) => { e.preventDefault(); go(x.id); }}>{x.label}</a>
        </li>
      ))}
    </ul>
    </>
  );
}
