"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Phase, Progress, emptyProgress, phases } from "@/lib/roadmap";

const LS_KEY = "ai-roadmap-progress-v1";

export type SaveState = "loading" | "file" | "browser" | "saving";

interface Ctx {
  progress: Progress;
  done: Record<string, string>;
  loaded: boolean;
  saveState: SaveState;
  toggle: (id: string) => void;
  setMany: (ids: string[], on: boolean) => void;
  setNote: (key: string, text: string) => void;
  replace: (p: Progress) => void;
  reset: () => void;
}

const ProgressCtx = createContext<Ctx | null>(null);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<Progress>(emptyProgress());
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let data: Progress | null = null;
      let fromFile = false;
      try {
        const res = await fetch("/api/progress", { cache: "no-store" });
        if (res.ok) {
          const j = await res.json();
          if (j && j.done) {
            data = { version: 1, done: j.done, notes: j.notes ?? {}, updatedAt: j.updatedAt };
            fromFile = true;
          }
        }
      } catch { /* ignore */ }
      let local: Progress | null = null;
      try {
        const s = localStorage.getItem(LS_KEY);
        if (s) local = JSON.parse(s);
      } catch { /* ignore */ }
      if (data && Object.keys(data.done).length === 0 && local && Object.keys(local.done).length > 0) data = local;
      if (!data) data = local ?? emptyProgress();
      if (cancelled) return;
      setProgress(data);
      setSaveState(fromFile ? "file" : "browser");
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(async () => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(progress)); } catch { /* ignore */ }
      try {
        const res = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done: progress.done, notes: progress.notes }),
        });
        setSaveState(res.ok ? "file" : "browser");
      } catch { setSaveState("browser"); }
    }, 350);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [progress, loaded]);

  const toggle = useCallback((id: string) => {
    setProgress((p) => {
      const next = { ...p.done };
      if (next[id]) delete next[id]; else next[id] = new Date().toISOString();
      return { ...p, done: next };
    });
  }, []);

  const setMany = useCallback((ids: string[], on: boolean) => {
    setProgress((p) => {
      const next = { ...p.done };
      const now = new Date().toISOString();
      for (const id of ids) { if (on) next[id] = next[id] ?? now; else delete next[id]; }
      return { ...p, done: next };
    });
  }, []);

  const setNote = useCallback((key: string, text: string) => {
    setProgress((p) => {
      const notes = { ...p.notes };
      if (text) notes[key] = text; else delete notes[key];
      return { ...p, notes };
    });
  }, []);

  const replace = useCallback((p: Progress) => setProgress(p), []);
  const reset = useCallback(() => setProgress(emptyProgress()), []);

  const value = useMemo<Ctx>(
    () => ({ progress, done: progress.done, loaded, saveState, toggle, setMany, setNote, replace, reset }),
    [progress, loaded, saveState, toggle, setMany, setNote, replace, reset]
  );
  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>;
}

export function useProgress() {
  const c = useContext(ProgressCtx);
  if (!c) throw new Error("useProgress outside provider");
  return c;
}

export function phaseProgress(p: Phase, done: Record<string, string>) {
  let d = 0, total = 0, q = 0, qTotal = 0, topicsDone = 0;
  for (const t of p.topics) {
    const a = t.items.filter((i) => done[i.id]).length;
    d += a; total += t.items.length;
    q += t.questions.filter((i) => done[i.id]).length; qTotal += t.questions.length;
    if (t.items.length > 0 && a === t.items.length) topicsDone++;
  }
  const cpItems = [...p.checkpoint.mustKnow, ...p.checkpoint.mustDo];
  const cpDone = cpItems.filter((i) => done[i.id]).length;
  return { done: d + cpDone, total: total + cpItems.length, q, qTotal, topicsDone, topics: p.topics.length, cpDone, cpTotal: cpItems.length };
}

export function overallProgress(done: Record<string, string>) {
  let d = 0, total = 0;
  for (const p of phases) {
    const s = phaseProgress(p, done);
    d += s.done; total += s.total;
  }
  return total === 0 ? 0 : Math.round((d / total) * 100);
}
