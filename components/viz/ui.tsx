"use client";

import { useEffect, useRef, useState } from "react";

/** Runs cb every `ms` while `active` is true. */
export function useInterval(cb: () => void, ms: number, active = true) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms, active]);
}

/** Deterministic string hash to [0,1). */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Seeded PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const fmt = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(1) + "T";
  if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return a < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.round(n).toString();
};

export const bytes = (n: number) => {
  const u = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${u[i]}`;
};

export function Viz({ title, hint, children }: { title?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="viz">
      {(title || hint) && (
        <div className="viz-head">
          {title && <b>{title}</b>}
          {hint && <span>{hint}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Btn({ children, onClick, on, kind, disabled }: { children: React.ReactNode; onClick: () => void; on?: boolean; kind?: "primary" | "danger"; disabled?: boolean }) {
  return (
    <button className={`vbtn ${on ? "on" : ""} ${kind ?? ""}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, show }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; show?: (v: number) => string }) {
  return (
    <label className="vslider">
      <span>{label} <b>{show ? show(value) : value}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "warn" }) {
  return (
    <div className={`vstat ${tone ?? ""}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

export interface FlowNode { id: string; label: string; sub?: string; icon?: string }
export interface FlowStep { at: string; note: string; ms?: number; tone?: "good" | "bad" | "warn" }

/** Generic node-to-node animated flow with step log. */
export function Flow({ nodes, steps, speed = 900 }: { nodes: FlowNode[]; steps: FlowStep[]; speed?: number }) {
  const [i, setI] = useState(-1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => { setI(-1); setPlaying(false); }, [steps]);

  useInterval(() => {
    setI((x) => {
      if (x >= steps.length - 1) { setPlaying(false); return x; }
      return x + 1;
    });
  }, speed, playing);

  const visited = new Set(steps.slice(0, Math.max(0, i + 1)).map((s) => s.at));
  const active = i >= 0 ? steps[i].at : null;
  const total = steps.slice(0, Math.max(0, i + 1)).reduce((a, s) => a + (s.ms ?? 0), 0);

  return (
    <div className="flow">
      <div className="flow-nodes">
        {nodes.map((n, idx) => (
          <div key={n.id} className="flow-cell">
            <div className={`fnode ${active === n.id ? "active" : ""} ${visited.has(n.id) ? "seen" : ""}`}>
              <span className="fico">{n.icon ?? "◼"}</span>
              <b>{n.label}</b>
              {n.sub && <small>{n.sub}</small>}
            </div>
            {idx < nodes.length - 1 && <span className="farrow" aria-hidden>→</span>}
          </div>
        ))}
      </div>
      <div className="vrow">
        <Btn kind="primary" onClick={() => { if (i >= steps.length - 1) setI(-1); setPlaying(true); }}>{playing ? "Playing…" : i >= steps.length - 1 && i >= 0 ? "Replay" : "▶ Play"}</Btn>
        <Btn onClick={() => { setPlaying(false); setI((x) => Math.min(steps.length - 1, x + 1)); }}>Step</Btn>
        <Btn onClick={() => { setPlaying(false); setI(-1); }}>Reset</Btn>
        <span className="vsp" />
        <span className="vtotal">Elapsed <b>{total} ms</b></span>
      </div>
      <ol className="flow-log">
        {steps.map((s, idx) => (
          <li key={idx} className={`${idx === i ? "now" : ""} ${idx < i ? "past" : ""} ${s.tone ?? ""}`}>
            <span className="fi">{idx + 1}</span>
            <span className="fn">{s.note}</span>
            {s.ms !== undefined && <em>{s.ms} ms</em>}
          </li>
        ))}
      </ol>
    </div>
  );
}
