"use client";

import { useMemo, useRef, useState } from "react";
import { Btn, Slider, Stat, Viz, useInterval } from "./ui";

type Algo = "fixed" | "log" | "slide" | "token" | "leaky";

const META: Record<Algo, { name: string; color: string; rule: string }> = {
  fixed: { name: "Fixed window counter", color: "#f97316", rule: "count per aligned window; reset at the boundary" },
  log: { name: "Sliding window log", color: "#2563eb", rule: "keep every timestamp; count those in (t - W, t]" },
  slide: { name: "Sliding window counter", color: "#7c3aed", rule: "estimate = prev × (1 − elapsed/W) + current" },
  token: { name: "Token bucket", color: "#16a34a", rule: "refill L/W tokens per second up to L; each request costs 1" },
  leaky: { name: "Leaky bucket (meter)", color: "#db2777", rule: "level drains at L/W per second; reject if level + 1 > L" },
};
const ORDER: Algo[] = ["fixed", "log", "slide", "token", "leaky"];

interface Decision { t: number; ok: boolean }
interface Result { decisions: Decision[]; state: string; load: number }

function run(algo: Algo, times: number[], now: number, W: number, L: number): Result {
  const decisions: Decision[] = [];
  const rate = L / W;
  // fixed
  const counts = new Map<number, number>();
  // log
  const allowedTs: number[] = [];
  // sliding counter
  const wc = new Map<number, number>();
  // bucket
  let tokens = L, last = times.length ? times[0] : 0;
  let level = 0;
  for (const t of times) {
    let ok = false;
    if (algo === "fixed") {
      const w = Math.floor(t / W);
      const c = counts.get(w) ?? 0;
      if (c < L) { counts.set(w, c + 1); ok = true; }
    } else if (algo === "log") {
      const recent = allowedTs.filter((x) => x > t - W).length;
      if (recent < L) { allowedTs.push(t); ok = true; }
    } else if (algo === "slide") {
      const w = Math.floor(t / W);
      const cur = wc.get(w) ?? 0;
      const prev = wc.get(w - 1) ?? 0;
      const est = prev * (1 - (t - w * W) / W) + cur;
      if (est + 1 <= L) { wc.set(w, cur + 1); ok = true; }
    } else if (algo === "token") {
      tokens = Math.min(L, tokens + (t - last) * rate); last = t;
      if (tokens >= 1) { tokens -= 1; ok = true; }
    } else {
      level = Math.max(0, level - (t - last) * rate); last = t;
      if (level + 1 <= L) { level += 1; ok = true; }
    }
    decisions.push({ t, ok });
  }
  let state = "", load = 0;
  if (algo === "fixed") {
    const w = Math.floor(now / W);
    const c = counts.get(w) ?? 0;
    state = `window #${w}: ${c}/${L} used`; load = c / L;
  } else if (algo === "log") {
    const n = allowedTs.filter((x) => x > now - W).length;
    state = `${n} timestamps in last ${W}s`; load = n / L;
  } else if (algo === "slide") {
    const w = Math.floor(now / W);
    const cur = wc.get(w) ?? 0, prev = wc.get(w - 1) ?? 0;
    const est = prev * (1 - (now - w * W) / W) + cur;
    state = `prev ${prev} × ${(1 - (now - w * W) / W).toFixed(2)} + cur ${cur} = ${est.toFixed(2)}`; load = est / L;
  } else if (algo === "token") {
    const tk = Math.min(L, tokens + (now - last) * rate);
    state = `${tk.toFixed(1)} / ${L} tokens`; load = 1 - tk / L;
  } else {
    const lv = Math.max(0, level - (now - last) * rate);
    state = `level ${lv.toFixed(1)} / ${L}`; load = lv / L;
  }
  return { decisions, state, load: Math.max(0, Math.min(1, load)) };
}

/** Max number of allowed requests inside any span of length W. */
function worstSpan(ds: Decision[], W: number) {
  const a = ds.filter((d) => d.ok).map((d) => d.t);
  let best = 0;
  for (let i = 0; i < a.length; i++) {
    let c = 0;
    for (let j = i; j < a.length && a[j] < a[i] + W; j++) c++;
    best = Math.max(best, c);
  }
  return best;
}

const SPAN = 36; // seconds visible

function Timeline({ algo, res, now, W }: { algo: Algo; res: Result; now: number; W: number }) {
  const w = 640, h = 54, pad = 6;
  const x = (t: number) => pad + ((t - (now - SPAN)) / SPAN) * (w - pad * 2);
  const fixedLines: number[] = [];
  if (algo === "fixed") for (let k = Math.floor((now - SPAN) / W); k <= Math.ceil(now / W); k++) fixedLines.push(k * W);
  const m = META[algo];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="rl-svg" role="img" aria-label={`${m.name} timeline`}>
      <rect x={0} y={0} width={w} height={h} rx={8} fill="var(--c-w)" stroke="var(--c-bd)" />
      {algo === "fixed" ? (
        <>
          {fixedLines.map((t) => <line key={t} x1={x(t)} x2={x(t)} y1={4} y2={h - 4} stroke="#f6c492" strokeDasharray="3 3" />)}
          {(() => { const s = Math.floor(now / W) * W; return <rect x={Math.max(pad, x(s))} y={4} width={Math.max(0, x(now) - Math.max(pad, x(s)))} height={h - 8} fill="#f9731622" />; })()}
        </>
      ) : (
        <rect x={Math.max(pad, x(now - W))} y={4} width={Math.max(0, x(now) - Math.max(pad, x(now - W)))} height={h - 8} fill={m.color + "22"} stroke={m.color + "66"} />
      )}
      <line x1={x(now)} x2={x(now)} y1={2} y2={h - 2} stroke="var(--text)" strokeWidth={1.5} />
      {res.decisions.filter((d) => d.t > now - SPAN && d.t <= now + 0.001).map((d, i) => (
        <circle key={i} cx={x(d.t)} cy={d.ok ? 20 : 38} r={5} fill={d.ok ? "#22c55e" : "#ef4444"} opacity={0.9} />
      ))}
      <text x={8} y={14} fontSize={9} fill="var(--muted)">allowed</text>
      <text x={8} y={50} fontSize={9} fill="var(--muted)">blocked</text>
    </svg>
  );
}

export function RateLimitCompare() {
  const [W, setW] = useState(10);
  const [L, setL] = useState(5);
  const [now, setNow] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [playing, setPlaying] = useState(true);
  const [auto, setAuto] = useState(0); // requests per second average
  const seed = useRef(1);

  useInterval(() => {
    setNow((n) => n + 0.1);
    if (auto > 0) {
      seed.current = (seed.current * 16807) % 2147483647;
      const r = seed.current / 2147483647;
      if (r < auto * 0.1) setTimes((ts) => [...ts, now + 0.1]);
    }
  }, 100, playing);

  const send = (n = 1, gap = 0.05) => setTimes((ts) => [...ts, ...Array.from({ length: n }, (_, i) => now + i * gap)].sort((a, b) => a - b));
  const reset = () => { setNow(0); setTimes([]); };
  const boundary = () => {
    const ts: number[] = [];
    for (let i = 0; i < L; i++) ts.push(W - 0.9 + i * 0.1);
    for (let i = 0; i < L; i++) ts.push(W + 0.1 + i * 0.1);
    setTimes(ts); setNow(W + 1.2);
    setPlaying(false); setAuto(0);
  };

  const visible = useMemo(() => times.filter((t) => t <= now + 0.001), [times, now]);
  const results = useMemo(() => {
    const r = {} as Record<Algo, Result>;
    ORDER.forEach((a) => (r[a] = run(a, visible, now, W, L)));
    return r;
  }, [visible, now, W, L]);

  return (
    <Viz title="Rate limiting algorithms, side by side" hint={`Same traffic into five limiters. Limit L = ${L} requests per window W = ${W}s. Black line = now.`}>
      <div className="vrow">
        <Btn kind="primary" onClick={() => send(1)}>Send 1</Btn>
        <Btn onClick={() => send(L, 0.05)}>Burst of {L}</Btn>
        <Btn onClick={() => send(L * 2, 0.05)}>Burst of {L * 2}</Btn>
        <Btn onClick={boundary}>Boundary attack</Btn>
        <Btn on={playing} onClick={() => setPlaying((p) => !p)}>{playing ? "Pause clock" : "Resume clock"}</Btn>
        <Btn kind="danger" onClick={reset}>Reset</Btn>
      </div>
      <div className="vgrid2">
        <Slider label="Window W" value={W} min={4} max={20} onChange={(v) => { setW(v); }} show={(v) => v + "s"} />
        <Slider label="Limit L" value={L} min={2} max={10} onChange={setL} />
        <Slider label="Random traffic" value={auto} min={0} max={3} step={0.25} onChange={setAuto} show={(v) => (v === 0 ? "off" : v + "/s")} />
      </div>
      <div className="rl-grid">
        {ORDER.map((a) => {
          const r = results[a];
          const ok = r.decisions.filter((d) => d.ok).length;
          const no = r.decisions.length - ok;
          const worst = worstSpan(r.decisions, W);
          return (
            <div key={a} className="rl-card" style={{ borderColor: META[a].color + "88" }}>
              <div className="rl-head">
                <b style={{ color: META[a].color }}>{META[a].name}</b>
                <small>{META[a].rule}</small>
              </div>
              <Timeline algo={a} res={r} now={now} W={W} />
              <div className="rl-meter"><i style={{ width: `${r.load * 100}%`, background: META[a].color }} /></div>
              <div className="rl-state">{r.state}</div>
              <div className="vstats">
                <Stat label="allowed" value={String(ok)} tone="good" />
                <Stat label="blocked" value={String(no)} tone={no ? "bad" : undefined} />
                <Stat label={`max allowed in any ${W}s`} value={`${worst}`} tone={worst > L ? "bad" : undefined} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="vnote">Try “Boundary attack”: it sends L requests just before a window edge and L just after. Fixed window lets all {L * 2} through inside about one second (a 2× burst); sliding log, sliding counter and the buckets hold the line. Then try “Burst of {L}” and watch the buckets allow the burst but refill slowly.</p>
    </Viz>
  );
}
