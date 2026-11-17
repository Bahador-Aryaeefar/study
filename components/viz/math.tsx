"use client";

import { useMemo, useState } from "react";
import { Viz, Slider, Btn, Stat, rng } from "./ui";

const W = 520;
const H = 260;

/* ---------- Optimizer playground: GD / momentum / Adam on an ill-conditioned bowl ---------- */
type Opt = "gd" | "mom" | "adam";
function runOpt(opt: Opt, lr: number, kappa: number, steps = 60) {
  // f(x,y) = 0.5*(x^2 + kappa*y^2)
  let x = -4, y = 1.5, vx = 0, vy = 0, mx = 0, my = 0, sx = 0, sy = 0;
  const pts: [number, number][] = [[x, y]];
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  for (let t = 1; t <= steps; t++) {
    const gx = x, gy = kappa * y;
    if (opt === "gd") { x -= lr * gx; y -= lr * gy; }
    else if (opt === "mom") { vx = 0.9 * vx + gx; vy = 0.9 * vy + gy; x -= lr * vx; y -= lr * vy; }
    else {
      mx = b1 * mx + (1 - b1) * gx; my = b1 * my + (1 - b1) * gy;
      sx = b2 * sx + (1 - b2) * gx * gx; sy = b2 * sy + (1 - b2) * gy * gy;
      const mhx = mx / (1 - b1 ** t), mhy = my / (1 - b1 ** t);
      const shx = sx / (1 - b2 ** t), shy = sy / (1 - b2 ** t);
      x -= (lr * 10 * mhx) / (Math.sqrt(shx) + eps);
      y -= (lr * 10 * mhy) / (Math.sqrt(shy) + eps);
    }
    if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 50 || Math.abs(y) > 50) { pts.push([NaN, NaN]); break; }
    pts.push([x, y]);
  }
  return pts;
}

export function OptimizerLab() {
  const [lr, setLr] = useState(0.05);
  const [kappa, setKappa] = useState(20);
  const opts: { k: Opt; name: string; color: string }[] = [
    { k: "gd", name: "SGD", color: "#ef4444" },
    { k: "mom", name: "Momentum", color: "#3b82f6" },
    { k: "adam", name: "Adam", color: "#16a34a" },
  ];
  const runs = useMemo(() => opts.map((o) => ({ ...o, pts: runOpt(o.k, lr, kappa) })), [lr, kappa]); // eslint-disable-line react-hooks/exhaustive-deps
  const sx = (x: number) => W / 2 + x * 48;
  const sy = (y: number) => H / 2 - y * 48;
  const f = (p: [number, number]) => 0.5 * (p[0] ** 2 + kappa * p[1] ** 2);
  return (
    <Viz title="Optimizer playground" hint="Same start, same bowl f = ½(x² + κy²). Raise κ (ill-conditioning) and watch SGD zig-zag while Adam adapts per-coordinate. Raise lr until something diverges.">
      <div className="viz-row">
        <Slider label="learning rate" value={lr} min={0.005} max={0.15} step={0.005} onChange={setLr} show={(v) => v.toFixed(3)} />
        <Slider label="condition number κ" value={kappa} min={1} max={60} onChange={setKappa} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img" aria-label="Optimizer trajectories">
        {[0.5, 1, 2, 4, 8].map((r) => (
          <ellipse key={r} cx={W / 2} cy={H / 2} rx={Math.sqrt(2 * r) * 48} ry={Math.sqrt((2 * r) / kappa) * 48} fill="none" stroke="var(--line)" strokeWidth={1} />
        ))}
        {runs.map((r) => (
          <g key={r.k}>
            <polyline fill="none" stroke={r.color} strokeWidth={1.8} points={r.pts.filter((p) => !isNaN(p[0])).map((p) => `${sx(p[0])},${sy(p[1])}`).join(" ")} />
            {r.pts.filter((p) => !isNaN(p[0])).map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={i === 0 ? 4 : 1.6} fill={r.color} />)}
          </g>
        ))}
        <circle cx={W / 2} cy={H / 2} r={4} fill="none" stroke="var(--text)" />
      </svg>
      <div className="viz-stats">
        {runs.map((r) => {
          const last = r.pts[r.pts.length - 1];
          const diverged = isNaN(last[0]);
          return <Stat key={r.k} label={`${r.name} final loss`} value={diverged ? "diverged" : f(last).toExponential(1)} tone={diverged ? "bad" : f(last) < 1e-3 ? "good" : "warn"} />;
        })}
      </div>
    </Viz>
  );
}

/* ---------- Matrix transform: eigenvectors, SVD ---------- */
export function MatrixLab() {
  const [a, setA] = useState(1.6);
  const [b, setB] = useState(0.8);
  const [c, setC] = useState(0.2);
  const [d, setD] = useState(0.9);
  const tr = a + d, det = a * d - b * c;
  const disc = tr * tr - 4 * det;
  const real = disc >= 0;
  const l1 = real ? (tr + Math.sqrt(disc)) / 2 : NaN;
  const l2 = real ? (tr - Math.sqrt(disc)) / 2 : NaN;
  // singular values from AᵀA
  const p = a * a + c * c, q = a * b + c * d, r = b * b + d * d;
  const t2 = p + r, d2 = p * r - q * q;
  const s1 = Math.sqrt(Math.max(0, (t2 + Math.sqrt(Math.max(0, t2 * t2 - 4 * d2))) / 2));
  const s2 = Math.sqrt(Math.max(0, (t2 - Math.sqrt(Math.max(0, t2 * t2 - 4 * d2))) / 2));
  const S = 70, cx = 130, cy = 130;
  const circle = Array.from({ length: 73 }, (_, i) => { const t = (i / 72) * Math.PI * 2; return [Math.cos(t), Math.sin(t)]; });
  const tf = (x: number, y: number) => [a * x + b * y, c * x + d * y];
  const eigv = (l: number) => (Math.abs(b) > 1e-9 ? [b, l - a] : Math.abs(c) > 1e-9 ? [l - d, c] : l === a ? [1, 0] : [0, 1]);
  const norm = (v: number[]) => { const n = Math.hypot(v[0], v[1]) || 1; return [v[0] / n, v[1] / n]; };
  const axes = real ? [l1, l2].map((l) => ({ l, v: norm(eigv(l)) })) : [];
  const P = (x: number, y: number, ox: number) => `${ox + x * S},${cy - y * S}`;
  return (
    <Viz title="Matrix as a transformation" hint="Edit the 2×2 matrix A. The unit circle becomes an ellipse whose semi-axes are the singular values σ. Dashed lines are real eigenvectors (they only stretch by λ).">
      <div className="viz-row">
        <Slider label="a" value={a} min={-2} max={2} step={0.1} onChange={setA} show={(v) => v.toFixed(1)} />
        <Slider label="b" value={b} min={-2} max={2} step={0.1} onChange={setB} show={(v) => v.toFixed(1)} />
        <Slider label="c" value={c} min={-2} max={2} step={0.1} onChange={setC} show={(v) => v.toFixed(1)} />
        <Slider label="d" value={d} min={-2} max={2} step={0.1} onChange={setD} show={(v) => v.toFixed(1)} />
      </div>
      <div className="viz-row">
        <Btn onClick={() => { setA(1); setB(0); setC(0); setD(1); }}>Identity</Btn>
        <Btn onClick={() => { setA(0.7); setB(-0.7); setC(0.7); setD(0.7); }}>Rotation 45°</Btn>
        <Btn onClick={() => { setA(2); setB(0); setC(0); setD(0.2); }}>Low-rank-ish</Btn>
        <Btn onClick={() => { setA(1); setB(1); setC(1); setD(1); }}>Rank 1</Btn>
      </div>
      <svg viewBox="0 0 520 260" className="viz-svg" role="img" aria-label="Unit circle mapped by matrix A">
        <line x1={0} y1={cy} x2={260} y2={cy} stroke="var(--line)" /><line x1={cx} y1={0} x2={cx} y2={260} stroke="var(--line)" />
        <polyline fill="none" stroke="var(--muted)" strokeWidth={1.5} points={circle.map(([x, y]) => P(x, y, cx)).join(" ")} />
        <text x={8} y={16} fontSize={12} fill="var(--muted)">input: unit circle</text>
        <line x1={260} y1={cy} x2={520} y2={cy} stroke="var(--line)" /><line x1={390} y1={0} x2={390} y2={260} stroke="var(--line)" />
        <polyline fill="var(--c-t1)" stroke="var(--orange)" strokeWidth={2} points={circle.map(([x, y]) => { const [u, v] = tf(x, y); return P(u, v, 390); }).join(" ")} />
        {axes.map((ax, i) => (
          <line key={i} x1={390 - ax.v[0] * 120} y1={cy + ax.v[1] * 120} x2={390 + ax.v[0] * 120} y2={cy - ax.v[1] * 120} stroke={i ? "#3b82f6" : "#16a34a"} strokeDasharray="5 4" />
        ))}
        <text x={268} y={16} fontSize={12} fill="var(--muted)">output: A · circle</text>
      </svg>
      <div className="viz-stats">
        <Stat label="det A (area scale)" value={det.toFixed(2)} tone={Math.abs(det) < 0.05 ? "bad" : "good"} />
        <Stat label="eigenvalues" value={real ? `${l1.toFixed(2)}, ${l2.toFixed(2)}` : "complex (rotation)"} />
        <Stat label="singular values σ₁, σ₂" value={`${s1.toFixed(2)}, ${s2.toFixed(2)}`} />
        <Stat label="condition σ₁/σ₂" value={s2 < 1e-6 ? "∞ (singular)" : (s1 / s2).toFixed(1)} tone={s2 < 1e-6 || s1 / s2 > 20 ? "bad" : "good"} />
      </div>
    </Viz>
  );
}

/* ---------- Gaussians, KL divergence, entropy ---------- */
const pdf = (x: number, m: number, s: number) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
export function KLLab() {
  const [m1, setM1] = useState(0);
  const [s1, setS1] = useState(1);
  const [m2, setM2] = useState(1.5);
  const [s2, setS2] = useState(1.5);
  const klPQ = Math.log(s2 / s1) + (s1 * s1 + (m1 - m2) ** 2) / (2 * s2 * s2) - 0.5;
  const klQP = Math.log(s1 / s2) + (s2 * s2 + (m1 - m2) ** 2) / (2 * s1 * s1) - 0.5;
  const H1 = 0.5 * Math.log(2 * Math.PI * Math.E * s1 * s1);
  const xs = Array.from({ length: 121 }, (_, i) => -6 + (i / 120) * 12);
  const X = (x: number) => ((x + 6) / 12) * W;
  const Y = (v: number) => H - 20 - v * 190;
  const line = (m: number, s: number) => xs.map((x) => `${X(x)},${Y(pdf(x, m, s))}`).join(" ");
  return (
    <Viz title="KL divergence & entropy" hint="P (orange) is the 'truth', Q (blue) the model. KL(P‖Q) ≠ KL(Q‖P): push Q narrow and watch them diverge. This asymmetry is why VAEs are mode-seeking and MLE is mass-covering.">
      <div className="viz-row">
        <Slider label="μ_P" value={m1} min={-3} max={3} step={0.1} onChange={setM1} show={(v) => v.toFixed(1)} />
        <Slider label="σ_P" value={s1} min={0.4} max={3} step={0.1} onChange={setS1} show={(v) => v.toFixed(1)} />
        <Slider label="μ_Q" value={m2} min={-3} max={3} step={0.1} onChange={setM2} show={(v) => v.toFixed(1)} />
        <Slider label="σ_Q" value={s2} min={0.4} max={3} step={0.1} onChange={setS2} show={(v) => v.toFixed(1)} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img" aria-label="Two Gaussians">
        <line x1={0} y1={H - 20} x2={W} y2={H - 20} stroke="var(--line)" />
        <polyline fill="none" stroke="var(--orange)" strokeWidth={2.2} points={line(m1, s1)} />
        <polyline fill="none" stroke="#3b82f6" strokeWidth={2.2} points={line(m2, s2)} />
      </svg>
      <div className="viz-stats">
        <Stat label="H(P) nats" value={H1.toFixed(2)} />
        <Stat label="KL(P‖Q)" value={klPQ.toFixed(3)} tone={klPQ < 0.1 ? "good" : "warn"} />
        <Stat label="KL(Q‖P)" value={klQP.toFixed(3)} tone={klQP < 0.1 ? "good" : "warn"} />
        <Stat label="cross-entropy H(P,Q)" value={(H1 + klPQ).toFixed(2)} />
      </div>
    </Viz>
  );
}

/* ---------- Bias–variance / overfitting (polynomial fit) ---------- */
function fitPoly(xs: number[], ys: number[], deg: number, lam: number) {
  const n = deg + 1;
  const A: number[][] = Array.from({ length: n }, () => Array(n + 1).fill(0));
  for (let i = 0; i < xs.length; i++) {
    const pw = Array.from({ length: n }, (_, k) => xs[i] ** k);
    for (let r = 0; r < n; r++) { for (let c2 = 0; c2 < n; c2++) A[r][c2] += pw[r] * pw[c2]; A[r][n] += pw[r] * ys[i]; }
  }
  for (let r = 1; r < n; r++) A[r][r] += lam;
  for (let i = 0; i < n; i++) {
    let mx = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[mx][i])) mx = r;
    [A[i], A[mx]] = [A[mx], A[i]];
    const pv = A[i][i] || 1e-12;
    for (let r = i + 1; r < n; r++) { const f = A[r][i] / pv; for (let c2 = i; c2 <= n; c2++) A[r][c2] -= f * A[i][c2]; }
  }
  const w = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = A[i][n]; for (let j = i + 1; j < n; j++) s -= A[i][j] * w[j]; w[i] = s / (A[i][i] || 1e-12); }
  return w;
}
export function BiasVarianceLab() {
  const [deg, setDeg] = useState(3);
  const [lam, setLam] = useState(0);
  const [noise, setNoise] = useState(0.25);
  const [seed, setSeed] = useState(7);
  const truth = (x: number) => Math.sin(2 * Math.PI * x);
  const { tr, te } = useMemo(() => {
    const r = rng(seed);
    const mk = (n: number) => Array.from({ length: n }, () => { const x = r(); return [x, truth(x) + (r() + r() + r() - 1.5) * 2 * noise] as [number, number]; });
    return { tr: mk(14), te: mk(200) };
  }, [seed, noise]);
  const w = useMemo(() => fitPoly(tr.map((p) => p[0]), tr.map((p) => p[1]), deg, lam), [tr, deg, lam]);
  const pred = (x: number) => w.reduce((s, c2, k) => s + c2 * x ** k, 0);
  const mse = (d: [number, number][]) => d.reduce((s, p) => s + (pred(p[0]) - p[1]) ** 2, 0) / d.length;
  const etr = mse(tr), ete = mse(te);
  const X = (x: number) => 10 + x * (W - 20);
  const Y = (y: number) => H / 2 - Math.max(-2.2, Math.min(2.2, y)) * 50;
  const xs = Array.from({ length: 100 }, (_, i) => i / 99);
  return (
    <Viz title="Bias–variance & overfitting" hint="14 noisy points from sin(2πx). Raise degree: train error falls monotonically, test error is U-shaped. Add L2 (λ) to tame the high-degree fit. Resample to see variance.">
      <div className="viz-row">
        <Slider label="polynomial degree" value={deg} min={1} max={13} onChange={setDeg} />
        <Slider label="L2 λ (log10)" value={lam === 0 ? -6 : Math.log10(lam)} min={-6} max={1} step={0.5} onChange={(v) => setLam(v <= -6 ? 0 : 10 ** v)} show={(v) => (v <= -6 ? "0" : `1e${v}`)} />
        <Slider label="noise" value={noise} min={0.05} max={0.6} step={0.05} onChange={setNoise} show={(v) => v.toFixed(2)} />
        <Btn onClick={() => setSeed((s) => s + 1)}>Resample</Btn>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img" aria-label="Polynomial fit">
        <polyline fill="none" stroke="var(--muted)" strokeDasharray="4 4" points={xs.map((x) => `${X(x)},${Y(truth(x))}`).join(" ")} />
        <polyline fill="none" stroke="var(--orange)" strokeWidth={2.2} points={xs.map((x) => `${X(x)},${Y(pred(x))}`).join(" ")} />
        {tr.map((p, i) => <circle key={i} cx={X(p[0])} cy={Y(p[1])} r={3.5} fill="#3b82f6" />)}
      </svg>
      <div className="viz-stats">
        <Stat label="train MSE" value={etr.toFixed(3)} tone="good" />
        <Stat label="test MSE" value={ete > 50 ? ">50" : ete.toFixed(3)} tone={ete > 2 * etr + 0.05 ? "bad" : "good"} />
        <Stat label="gap" value={(ete - etr > 50 ? ">50" : (ete - etr).toFixed(3))} tone={ete - etr > 0.1 ? "warn" : "good"} />
      </div>
    </Viz>
  );
}

/* ---------- Softmax / temperature / cross-entropy ---------- */
export function SoftmaxLab() {
  const [logits, setLogits] = useState([2.0, 1.0, 0.1, -1.0]);
  const [T, setT] = useState(1);
  const [target, setTarget] = useState(0);
  const names = ["cat", "dog", "fox", "car"];
  const z = logits.map((l) => l / T);
  const mx = Math.max(...z);
  const ex = z.map((v) => Math.exp(v - mx));
  const sum = ex.reduce((a, b) => a + b, 0);
  const p = ex.map((v) => v / sum);
  const ce = -Math.log(Math.max(p[target], 1e-12));
  const ent = -p.reduce((s, v) => s + (v > 0 ? v * Math.log(v) : 0), 0);
  const grad = p.map((v, i) => v - (i === target ? 1 : 0));
  return (
    <Viz title="Softmax, temperature & cross-entropy" hint="Drag logits. Temperature T flattens (T→∞) or sharpens (T→0) the distribution. The gradient of cross-entropy wrt logits is simply p − y.">
      <div className="viz-row">
        <Slider label="temperature T" value={T} min={0.1} max={4} step={0.1} onChange={setT} show={(v) => v.toFixed(1)} />
        <Btn onClick={() => setTarget((t) => (t + 1) % 4)}>true class: {names[target]}</Btn>
      </div>
      {logits.map((l, i) => (
        <div key={i} className="viz-row" style={{ alignItems: "center" }}>
          <Slider label={`logit ${names[i]}`} value={l} min={-4} max={4} step={0.1} onChange={(v) => setLogits((a) => a.map((x, j) => (j === i ? v : x)))} show={(v) => v.toFixed(1)} />
          <div style={{ flex: 1, minWidth: 120, background: "var(--track)", borderRadius: 6, height: 14, position: "relative" }}>
            <div style={{ width: `${p[i] * 100}%`, height: "100%", borderRadius: 6, background: i === target ? "var(--orange)" : "#3b82f6" }} />
          </div>
          <span style={{ width: 120, fontSize: 12, color: "var(--muted)" }}>p={p[i].toFixed(3)} ∂L={grad[i].toFixed(2)}</span>
        </div>
      ))}
      <div className="viz-stats">
        <Stat label="cross-entropy loss" value={ce.toFixed(3)} tone={ce < 0.3 ? "good" : ce > 1.5 ? "bad" : "warn"} />
        <Stat label="entropy of p (nats)" value={ent.toFixed(3)} />
        <Stat label="max entropy ln K" value={Math.log(4).toFixed(3)} />
      </div>
    </Viz>
  );
}

/* ---------- Statistical significance: effect, n, p-value, power ---------- */
function erf(x: number) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
export function SignificanceLab() {
  const [delta, setDelta] = useState(0.8);
  const [sd, setSd] = useState(3);
  const [n, setN] = useState(5);
  const [runs, setRuns] = useState(0);
  const se = (sd * Math.SQRT2) / Math.sqrt(n);
  const z = delta / se;
  const pval = 2 * (1 - Phi(Math.abs(z)));
  const power = 1 - Phi(1.96 - z) + Phi(-1.96 - z);
  const needN = Math.ceil((2 * (1.96 + 0.84) ** 2 * sd * sd) / (delta * delta));
  const sim = useMemo(() => {
    const r = rng(runs + 11);
    const g = () => (r() + r() + r() + r() + r() + r() - 3) * Math.SQRT2;
    const a = Array.from({ length: n }, () => g() * sd);
    const b = Array.from({ length: n }, () => delta + g() * sd);
    const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
    const va = a.reduce((s, v) => s + (v - ma) ** 2, 0) / Math.max(1, n - 1), vb = b.reduce((s, v) => s + (v - mb) ** 2, 0) / Math.max(1, n - 1);
    const zz = (mb - ma) / Math.sqrt((va + vb) / n + 1e-12);
    return { diff: mb - ma, p: 2 * (1 - Phi(Math.abs(zz))) };
  }, [runs, n, sd, delta]);
  return (
    <Viz title="Is my improvement real? (power & p-values)" hint="You beat the baseline by Δ points on a metric with seed-to-seed std σ, using n seeds each. Power says how often you'd detect it; the simulated run shows how noisy a single paper-table comparison is.">
      <div className="viz-row">
        <Slider label="true improvement Δ" value={delta} min={0} max={3} step={0.1} onChange={setDelta} show={(v) => v.toFixed(1)} />
        <Slider label="seed std σ" value={sd} min={0.5} max={6} step={0.5} onChange={setSd} show={(v) => v.toFixed(1)} />
        <Slider label="seeds n" value={n} min={2} max={50} onChange={setN} />
        <Btn onClick={() => setRuns((r) => r + 1)}>Run one experiment</Btn>
      </div>
      <div className="viz-stats">
        <Stat label="expected p-value" value={pval.toFixed(3)} tone={pval < 0.05 ? "good" : "bad"} />
        <Stat label="power (α=.05)" value={`${(power * 100).toFixed(0)}%`} tone={power > 0.8 ? "good" : power > 0.5 ? "warn" : "bad"} />
        <Stat label="n needed for 80% power" value={String(needN)} />
        <Stat label="this run: observed Δ" value={`${sim.diff.toFixed(2)} (p=${sim.p.toFixed(2)})`} tone={sim.p < 0.05 ? "good" : "warn"} />
      </div>
    </Viz>
  );
}

/* ---------- Backprop on a tiny computation graph ---------- */
export function BackpropLab() {
  const [x, setX] = useState(1.0);
  const [w, setW] = useState(0.8);
  const [b, setB] = useState(-0.3);
  const [y, setY] = useState(1);
  const [lr, setLr] = useState(0.5);
  const z = w * x + b;
  const a = 1 / (1 + Math.exp(-z));
  const L = 0.5 * (a - y) ** 2;
  const dA = a - y, dZ = dA * a * (1 - a), dW = dZ * x, dB = dZ;
  const Box = ({ x: bx, label, v, g }: { x: number; label: string; v: number; g?: number }) => (
    <g>
      <rect x={bx} y={70} width={90} height={80} rx={10} fill="var(--soft)" stroke="var(--line)" />
      <text x={bx + 45} y={92} textAnchor="middle" fontSize={12} fill="var(--muted)">{label}</text>
      <text x={bx + 45} y={116} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--text)">{v.toFixed(3)}</text>
      {g !== undefined && <text x={bx + 45} y={138} textAnchor="middle" fontSize={12} fill="var(--orange-d)">∂L = {g.toFixed(3)}</text>}
    </g>
  );
  return (
    <Viz title="Backprop on a one-neuron graph" hint="L = ½(σ(wx+b) − y)². Forward values are black, backward gradients orange — each is the upstream gradient times a local derivative. Press 'Step' to apply one SGD update.">
      <div className="viz-row">
        <Slider label="x" value={x} min={-2} max={2} step={0.1} onChange={setX} show={(v) => v.toFixed(1)} />
        <Slider label="w" value={w} min={-2} max={2} step={0.1} onChange={setW} show={(v) => v.toFixed(1)} />
        <Slider label="b" value={b} min={-2} max={2} step={0.1} onChange={setB} show={(v) => v.toFixed(1)} />
        <Btn onClick={() => setY((v) => 1 - v)}>target y = {y}</Btn>
        <Slider label="lr" value={lr} min={0.1} max={3} step={0.1} onChange={setLr} show={(v) => v.toFixed(1)} />
        <Btn kind="primary" onClick={() => { setW(Math.max(-2, Math.min(2, w - lr * dW))); setB(Math.max(-2, Math.min(2, b - lr * dB))); }}>Step</Btn>
      </div>
      <svg viewBox="0 0 560 200" className="viz-svg" role="img" aria-label="Computation graph">
        <Box x={10} label="w, x, b" v={w} g={dW} />
        <Box x={150} label="z = wx+b" v={z} g={dZ} />
        <Box x={290} label="a = σ(z)" v={a} g={dA} />
        <Box x={430} label="L = ½(a−y)²" v={L} g={1} />
        {[100, 240, 380].map((px) => <line key={px} x1={px} y1={110} x2={px + 50} y2={110} stroke="var(--muted)" markerEnd="url(#ar)" />)}
        <defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6z" fill="var(--muted)" /></marker></defs>
        <text x={280} y={185} textAnchor="middle" fontSize={12} fill="var(--muted)">∂L/∂z = (a−y)·a(1−a)   ·   ∂L/∂w = ∂L/∂z · x   ·   ∂L/∂b = ∂L/∂z</text>
      </svg>
      <div className="viz-stats">
        <Stat label="loss" value={L.toFixed(4)} tone={L < 0.02 ? "good" : "warn"} />
        <Stat label="∂L/∂w" value={dW.toFixed(4)} />
        <Stat label="vanishing? a(1−a)" value={(a * (1 - a)).toFixed(3)} tone={a * (1 - a) < 0.05 ? "bad" : "good"} />
      </div>
    </Viz>
  );
}

/* ---------- 1-D gradient descent: what a derivative and learning rate do ---------- */
export function GD1DLab() {
  const [x0, setX0] = useState(-3.5);
  const [lr, setLr] = useState(0.15);
  const [n, setN] = useState(0);
  const f = (x: number) => 0.25 * x ** 4 - 0.5 * x ** 2 + 0.15 * x + 0.6;
  const df = (x: number) => x ** 3 - x + 0.15;
  const path = useMemo(() => {
    const p = [x0];
    for (let i = 0; i < 40; i++) { const nx = p[i] - lr * df(p[i]); p.push(Math.max(-4, Math.min(4, nx))); }
    return p;
  }, [x0, lr]);
  const k = Math.min(n, path.length - 1);
  const x = path[k];
  const X = (v: number) => W / 2 + v * 60;
  const Y = (v: number) => H - 30 - v * 28;
  const xs = Array.from({ length: 161 }, (_, i) => -4 + i / 20);
  const slope = df(x);
  return (
    <Viz title="What is a derivative? Gradient descent in 1-D" hint="The slope (derivative) says which way is uphill. Step the opposite way, scaled by the learning rate. Too small = slow, too large = overshoot/diverge. Different start points can land in different minima.">
      <div className="viz-row">
        <Slider label="start x" value={x0} min={-3.5} max={3.5} step={0.1} onChange={(v) => { setX0(v); setN(0); }} show={(v) => v.toFixed(1)} />
        <Slider label="learning rate" value={lr} min={0.01} max={0.9} step={0.01} onChange={(v) => { setLr(v); setN(0); }} show={(v) => v.toFixed(2)} />
        <Btn kind="primary" onClick={() => setN((v) => Math.min(v + 1, 40))}>Step</Btn>
        <Btn onClick={() => setN(40)}>Run 40</Btn>
        <Btn onClick={() => setN(0)}>Reset</Btn>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img" aria-label="Gradient descent on a curve">
        <polyline fill="none" stroke="var(--muted)" strokeWidth={2} points={xs.map((v) => `${X(v)},${Y(f(v))}`).join(" ")} />
        {path.slice(0, k + 1).map((v, i) => <circle key={i} cx={X(v)} cy={Y(f(v))} r={i === k ? 6 : 2.5} fill={i === k ? "var(--orange)" : "#3b82f6"} />)}
        <line x1={X(x) - 40} y1={Y(f(x)) + slope * 40 * (28 / 60)} x2={X(x) + 40} y2={Y(f(x)) - slope * 40 * (28 / 60)} stroke="var(--orange)" strokeDasharray="4 3" />
      </svg>
      <div className="viz-stats">
        <Stat label="step" value={String(k)} />
        <Stat label="x" value={x.toFixed(3)} />
        <Stat label="f(x)" value={f(x).toFixed(3)} />
        <Stat label="slope f'(x)" value={slope.toFixed(3)} tone={Math.abs(slope) < 0.01 ? "good" : "warn"} />
      </div>
    </Viz>
  );
}

/* ---------- k-means clustering ---------- */
export function KMeansLab() {
  const [k, setK] = useState(3);
  const [iter, setIter] = useState(0);
  const [seed, setSeed] = useState(3);
  const pts = useMemo(() => {
    const r = rng(42);
    const g = () => (r() + r() + r() + r() - 2) * 0.9;
    const centers = [[-2, -1], [2, 1.2], [-0.5, 2.2], [2.5, -1.8]];
    return Array.from({ length: 120 }, (_, i) => { const c = centers[i % 4]; return [c[0] + g() * 0.9, c[1] + g() * 0.9]; });
  }, []);
  const state = useMemo(() => {
    const r = rng(seed);
    let cs = Array.from({ length: k }, () => pts[Math.floor(r() * pts.length)].slice());
    let asg: number[] = [];
    let inertia = 0;
    for (let t = 0; t <= iter; t++) {
      asg = pts.map((p) => { let b = 0, bd = Infinity; cs.forEach((c, i) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2; if (d < bd) { bd = d; b = i; } }); return b; });
      inertia = pts.reduce((s, p, i) => s + (p[0] - cs[asg[i]][0]) ** 2 + (p[1] - cs[asg[i]][1]) ** 2, 0);
      cs = cs.map((c, i) => { const m = pts.filter((_, j) => asg[j] === i); return m.length ? [m.reduce((s, p) => s + p[0], 0) / m.length, m.reduce((s, p) => s + p[1], 0) / m.length] : c; });
    }
    return { cs, asg, inertia };
  }, [k, iter, seed, pts]);
  const col = ["#ef4444", "#3b82f6", "#16a34a", "#f59e0b", "#a855f7", "#0ea5e9"];
  const X = (v: number) => W / 2 + v * 70;
  const Y = (v: number) => H / 2 - v * 55;
  return (
    <Viz title="k-means, step by step" hint="Each iteration: (1) assign every point to its nearest centroid, (2) move each centroid to the mean of its points. It always decreases inertia but can get stuck in a local optimum - resample the initialization and change k (true k here is 4).">
      <div className="viz-row">
        <Slider label="k clusters" value={k} min={1} max={6} onChange={(v) => { setK(v); setIter(0); }} />
        <Btn kind="primary" onClick={() => setIter((i) => Math.min(i + 1, 15))}>Iterate</Btn>
        <Btn onClick={() => { setSeed((s) => s + 1); setIter(0); }}>New init</Btn>
        <Btn onClick={() => setIter(0)}>Reset</Btn>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg" role="img" aria-label="k-means clusters">
        {pts.map((p, i) => <circle key={i} cx={X(p[0])} cy={Y(p[1])} r={3.2} fill={col[state.asg[i] % 6]} opacity={0.75} />)}
        {state.cs.map((c, i) => <g key={i}><circle cx={X(c[0])} cy={Y(c[1])} r={8} fill="none" stroke="var(--text)" strokeWidth={2} /><circle cx={X(c[0])} cy={Y(c[1])} r={3} fill={col[i % 6]} /></g>)}
      </svg>
      <div className="viz-stats">
        <Stat label="iteration" value={String(iter)} />
        <Stat label="inertia (within-cluster SS)" value={state.inertia.toFixed(1)} tone="warn" />
      </div>
    </Viz>
  );
}
