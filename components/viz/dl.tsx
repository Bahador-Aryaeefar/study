"use client";

import { useMemo, useState } from "react";
import { Viz, Slider, Btn, Stat, rng } from "./ui";

const W = 520;

/* ---------- Convolution: kernel sliding, feature map, output size, params ---------- */
const KERNELS: Record<string, number[][]> = {
  "Edge (vertical)": [[1, 0, -1], [2, 0, -2], [1, 0, -1]],
  "Edge (horizontal)": [[1, 2, 1], [0, 0, 0], [-1, -2, -1]],
  Blur: [[1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9]],
  Sharpen: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
};
export function ConvLab() {
  const N = 12;
  const [name, setName] = useState("Edge (vertical)");
  const [stride, setStride] = useState(1);
  const [pad, setPad] = useState(0);
  const [pos, setPos] = useState(0);
  const [cin, setCin] = useState(3);
  const [cout, setCout] = useState(16);
  const img = useMemo(() => Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => (x >= 4 && x < 9 && y >= 3 && y < 9 ? 1 : 0) + (Math.hypot(x - 9, y - 9) < 2 ? 0.6 : 0))), []);
  const K = KERNELS[name];
  const P = N + 2 * pad;
  const padded = (y: number, x: number) => { const yy = y - pad, xx = x - pad; return yy < 0 || xx < 0 || yy >= N || xx >= N ? 0 : img[yy][xx]; };
  const O = Math.floor((P - 3) / stride) + 1;
  const out = useMemo(() => Array.from({ length: O }, (_, oy) => Array.from({ length: O }, (_, ox) => { let s = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += K[i][j] * padded(oy * stride + i, ox * stride + j); return s; })), [O, stride, pad, name]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = Math.min(pos, O * O - 1);
  const oy = Math.floor(p / O), ox = p % O;
  const cell = 16;
  const mx = Math.max(0.001, ...out.flat().map(Math.abs));
  const params = 3 * 3 * cin * cout + cout;
  return (
    <Viz title="Convolution explorer" hint="Slide the 3×3 kernel over the image (left). Each output pixel (right) is a dot product of the kernel with the patch under it. Try stride and padding and watch the output size follow floor((n+2p−k)/s)+1. Params do not depend on image size.">
      <div className="viz-row">
        <select value={name} onChange={(e) => setName(e.target.value)} style={{ padding: 6, borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--text)" }}>{Object.keys(KERNELS).map((k) => <option key={k}>{k}</option>)}</select>
        <Slider label="stride" value={stride} min={1} max={3} onChange={(v) => { setStride(v); setPos(0); }} />
        <Slider label="padding" value={pad} min={0} max={2} onChange={(v) => { setPad(v); setPos(0); }} />
        <Slider label="position" value={p} min={0} max={O * O - 1} onChange={setPos} />
      </div>
      <svg viewBox={`0 0 ${W} 230`} className="viz-svg" role="img" aria-label="Convolution">
        <g transform="translate(8,10)">
          {Array.from({ length: P }, (_, y) => Array.from({ length: P }, (_, x) => { const v = padded(y, x); return <rect key={`${y}-${x}`} x={x * cell} y={y * cell} width={cell - 1} height={cell - 1} fill={`rgba(249,115,22,${0.08 + v * 0.8})`} />; }))}
          <rect x={ox * stride * cell} y={oy * stride * cell} width={3 * cell} height={3 * cell} fill="none" stroke="#3b82f6" strokeWidth={2.5} />
        </g>
        <g transform={`translate(${W / 2 + 20},10)`}>
          {out.map((row, y) => row.map((v, x) => <rect key={`${y}-${x}`} x={x * cell} y={y * cell} width={cell - 1} height={cell - 1} fill={v >= 0 ? `rgba(22,163,74,${0.08 + (v / mx) * 0.9})` : `rgba(239,68,68,${0.08 + (-v / mx) * 0.9})`} stroke={x === ox && y === oy ? "#3b82f6" : "none"} strokeWidth={2} />))}
        </g>
        <text x={8} y={226} fontSize={12} fill="var(--muted)">input {N}×{N} (+pad → {P}×{P})</text>
        <text x={W / 2 + 20} y={226} fontSize={12} fill="var(--muted)">feature map {O}×{O}</text>
      </svg>
      <div className="viz-row">
        <Slider label="C_in" value={cin} min={1} max={256} onChange={setCin} />
        <Slider label="C_out" value={cout} min={1} max={256} onChange={setCout} />
      </div>
      <div className="viz-stats">
        <Stat label="output size" value={`${O}×${O}`} />
        <Stat label="conv params (3×3)" value={params.toLocaleString()} />
        <Stat label="dense layer params, same 224² map" value={(224 * 224 * cin * (224 * 224 * cout)).toExponential(1)} tone="bad" />
        <Stat label="MACs per 224² image" value={(224 * 224 * 9 * cin * cout).toExponential(1)} />
      </div>
    </Viz>
  );
}

/* ---------- Self-attention heatmap with causal mask, scaling ---------- */
const TOK = ["The", "cat", "sat", "on", "the", "mat"];
export function AttentionLab() {
  const [causal, setCausal] = useState(true);
  const [dk, setDk] = useState(16);
  const [scale, setScale] = useState(true);
  const [q, setQ] = useState(2);
  const A = useMemo(() => {
    const r = rng(5);
    const mk = () => TOK.map(() => Array.from({ length: dk }, () => (r() + r() + r() - 1.5) * 1.6));
    const Q = mk(), Kk = mk();
    return TOK.map((_, i) => {
      const s = TOK.map((__, j) => {
        let d = 0; for (let t = 0; t < dk; t++) d += Q[i][t] * Kk[j][t];
        d = scale ? d / Math.sqrt(dk) : d;
        return causal && j > i ? -Infinity : d;
      });
      const m = Math.max(...s); const e = s.map((v) => Math.exp(v - m)); const z = e.reduce((a, b) => a + b, 0);
      return e.map((v) => v / z);
    });
  }, [dk, scale, causal]);
  const ent = (row: number[]) => -row.reduce((s, v) => s + (v > 0 ? v * Math.log(v) : 0), 0);
  const c = 46;
  return (
    <Viz title="Self-attention heatmap" hint="Row i = how much token i attends to each token j. Turn the causal mask on (decoder) or off (encoder). Remove the 1/√d_k scaling and raise d_k: rows saturate to one-hot (softmax saturation → vanishing gradients).">
      <div className="viz-row">
        <Btn on={causal} onClick={() => setCausal((v) => !v)}>causal mask {causal ? "ON" : "OFF"}</Btn>
        <Btn on={scale} onClick={() => setScale((v) => !v)}>scale 1/√d_k {scale ? "ON" : "OFF"}</Btn>
        <Slider label="d_k" value={dk} min={2} max={256} onChange={setDk} />
        <Slider label="query token" value={q} min={0} max={5} onChange={setQ} show={(v) => TOK[v]} />
      </div>
      <svg viewBox={`0 0 ${W} 300`} className="viz-svg" role="img" aria-label="Attention matrix">
        <g transform="translate(70,30)">
          {TOK.map((t, j) => <text key={j} x={j * c + c / 2} y={-8} textAnchor="middle" fontSize={12} fill="var(--muted)">{t}</text>)}
          {TOK.map((t, i) => <text key={i} x={-8} y={i * c + c / 2 + 4} textAnchor="end" fontSize={12} fill={i === q ? "var(--orange)" : "var(--muted)"}>{t}</text>)}
          {A.map((row, i) => row.map((v, j) => <g key={`${i}-${j}`}><rect x={j * c} y={i * c} width={c - 2} height={c - 2} rx={4} fill={`rgba(249,115,22,${0.05 + v * 0.95})`} stroke={i === q ? "#3b82f6" : "none"} /><text x={j * c + c / 2 - 1} y={i * c + c / 2 + 3} textAnchor="middle" fontSize={10} fill="var(--text)">{v.toFixed(2)}</text></g>))}
        </g>
      </svg>
      <div className="viz-stats">
        <Stat label={`entropy of row "${TOK[q]}"`} value={ent(A[q]).toFixed(3)} />
        <Stat label="max possible (uniform over allowed)" value={Math.log(causal ? q + 1 : 6).toFixed(3)} />
        <Stat label="saturated?" value={Math.max(...A[q]) > 0.98 ? "yes (one-hot)" : "no"} tone={Math.max(...A[q]) > 0.98 && q > 0 ? "bad" : "good"} />
      </div>
    </Viz>
  );
}

/* ---------- BPE tokenizer training ---------- */
export function BPELab() {
  const corpus = "low lower lowest newer newest wider widest low low newer";
  const [merges, setMerges] = useState(0);
  const { words, log } = useMemo(() => {
    let ws = corpus.split(" ").map((w) => w.split("").concat("</w>"));
    const lg: string[] = [];
    for (let m = 0; m < merges; m++) {
      const cnt = new Map<string, number>();
      ws.forEach((w) => { for (let i = 0; i < w.length - 1; i++) { const k = w[i] + "\u0000" + w[i + 1]; cnt.set(k, (cnt.get(k) ?? 0) + 1); } });
      let best = "", bc = 0;
      cnt.forEach((v, k) => { if (v > bc) { bc = v; best = k; } });
      if (!best) break;
      const [a, b] = best.split("\u0000");
      lg.push(`${a} + ${b} → ${a}${b}   (count ${bc})`);
      ws = ws.map((w) => { const o: string[] = []; for (let i = 0; i < w.length; i++) { if (i < w.length - 1 && w[i] === a && w[i + 1] === b) { o.push(a + b); i++; } else o.push(w[i]); } return o; });
    }
    return { words: ws, log: lg };
  }, [merges]);
  const vocab = new Set(words.flat());
  return (
    <Viz title="Byte-pair encoding, step by step" hint="Start from characters. Repeatedly merge the most frequent adjacent pair into a new token. More merges → bigger vocabulary, shorter sequences. Corpus: low lower lowest newer newest wider widest low low newer.">
      <div className="viz-row"><Slider label="merges" value={merges} min={0} max={14} onChange={setMerges} /><Btn onClick={() => setMerges(0)}>Reset</Btn></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "8px 0" }}>
        {words.map((w, i) => <div key={i} style={{ display: "flex", gap: 3 }}>{w.map((t, j) => <span key={j} style={{ padding: "3px 7px", borderRadius: 6, background: t.length > 1 ? "var(--c-t2)" : "var(--soft)", border: "1px solid var(--line)", fontSize: 13, fontFamily: "monospace" }}>{t.replace("</w>", "·")}</span>)}</div>)}
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)", maxHeight: 120, overflow: "auto" }}>{log.map((l, i) => <div key={i}>{i + 1}. {l}</div>)}</div>
      <div className="viz-stats">
        <Stat label="vocab size" value={String(vocab.size)} />
        <Stat label="total tokens" value={String(words.flat().length)} tone="good" />
        <Stat label="chars baseline" value={String(corpus.replace(/ /g, "").length + words.length)} />
      </div>
    </Viz>
  );
}

/* ---------- Training memory & FLOPs calculator ---------- */
export function TrainMemLab() {
  const [pB, setP] = useState(7);
  const [tokB, setTok] = useState(140);
  const [mode, setMode] = useState<"adam" | "lora" | "infer">("adam");
  const [prec, setPrec] = useState<2 | 4>(2);
  const [gpus, setGpus] = useState(64);
  const [mfu, setMfu] = useState(40);
  const P = pB * 1e9;
  const weights = P * prec;
  let grads = 0, opt = 0;
  if (mode === "adam") { grads = P * prec; opt = P * 12; } // fp32 master + m + v
  if (mode === "lora") { grads = P * 0.01 * prec; opt = P * 0.01 * 12; }
  const total = weights + grads + opt;
  const gb = (b: number) => (b / 1e9).toFixed(0);
  const flops = 6 * P * tokB * 1e9;
  const peak = 312e12; // A100 bf16
  const secs = flops / (gpus * peak * (mfu / 100));
  return (
    <Viz title="Training memory & compute calculator" hint="Rules of thumb every paper assumes: full Adam training in mixed precision ≈ 16 bytes/param before activations; training FLOPs ≈ 6·N·D. Change model size, tokens, GPUs and MFU. (Activations excluded: they depend on batch/sequence and checkpointing.)">
      <div className="viz-row">
        <Slider label="params (B)" value={pB} min={0.1} max={405} step={0.1} onChange={setP} show={(v) => `${v}B`} />
        <Slider label="tokens (B)" value={tokB} min={1} max={15000} onChange={setTok} show={(v) => `${v}B`} />
        <Btn on={mode === "adam"} onClick={() => setMode("adam")}>full + AdamW</Btn>
        <Btn on={mode === "lora"} onClick={() => setMode("lora")}>LoRA (1%)</Btn>
        <Btn on={mode === "infer"} onClick={() => setMode("infer")}>inference</Btn>
        <Btn on={prec === 2} onClick={() => setPrec(prec === 2 ? 4 : 2)}>weights {prec === 2 ? "bf16" : "fp32"}</Btn>
      </div>
      <div className="viz-stats">
        <Stat label="weights" value={`${gb(weights)} GB`} />
        <Stat label="gradients" value={`${gb(grads)} GB`} />
        <Stat label="optimizer state (fp32 master+m+v)" value={`${gb(opt)} GB`} />
        <Stat label="total (no activations)" value={`${gb(total)} GB`} tone={total > 80e9 ? "bad" : "good"} />
        <Stat label="fits one 80GB GPU?" value={total <= 80e9 ? "yes" : `no: shard over ≥${Math.ceil(total / 70e9)} GPUs (ZeRO/FSDP)`} tone={total <= 80e9 ? "good" : "warn"} />
      </div>
      <div className="viz-row">
        <Slider label="GPUs (A100)" value={gpus} min={1} max={4096} onChange={setGpus} />
        <Slider label="MFU %" value={mfu} min={10} max={65} onChange={setMfu} />
      </div>
      <div className="viz-stats">
        <Stat label="training FLOPs 6ND" value={flops.toExponential(2)} />
        <Stat label="wall-clock" value={secs > 86400 ? `${(secs / 86400).toFixed(1)} days` : `${(secs / 3600).toFixed(1)} hours`} tone={secs > 86400 * 60 ? "bad" : "good"} />
        <Stat label="GPU-hours" value={((secs * gpus) / 3600).toExponential(2)} />
      </div>
    </Viz>
  );
}

/* ---------- LR schedule ---------- */
export function ScheduleLab() {
  const [warm, setWarm] = useState(5);
  const [kind, setKind] = useState<"cosine" | "linear" | "constant" | "wsd">("cosine");
  const [minr, setMinr] = useState(10);
  const T = 100;
  const lr = (t: number) => {
    if (t < warm) return (t + 1) / warm;
    const p = (t - warm) / (T - warm);
    const lo = minr / 100;
    if (kind === "constant") return 1;
    if (kind === "linear") return lo + (1 - lo) * (1 - p);
    if (kind === "wsd") return p < 0.8 ? 1 : lo + (1 - lo) * (1 - (p - 0.8) / 0.2);
    return lo + (1 - lo) * 0.5 * (1 + Math.cos(Math.PI * p));
  };
  const pts = Array.from({ length: T }, (_, t) => `${10 + (t / (T - 1)) * (W - 20)},${150 - lr(t) * 130}`).join(" ");
  return (
    <Viz title="Learning-rate schedules" hint="Warmup protects Adam's early noisy second-moment estimates; decay lets the model settle into a flatter minimum. WSD (warmup-stable-decay) lets you branch decays off a long stable run.">
      <div className="viz-row">
        {(["cosine", "linear", "constant", "wsd"] as const).map((k) => <Btn key={k} on={kind === k} onClick={() => setKind(k)}>{k}</Btn>)}
        <Slider label="warmup %" value={warm} min={0} max={20} onChange={setWarm} />
        <Slider label="final LR %" value={minr} min={0} max={50} onChange={setMinr} />
      </div>
      <svg viewBox={`0 0 ${W} 170`} className="viz-svg" role="img" aria-label="LR schedule">
        <line x1={10} y1={150} x2={W - 10} y2={150} stroke="var(--line)" />
        <polyline fill="none" stroke="var(--orange)" strokeWidth={2.4} points={pts} />
      </svg>
    </Viz>
  );
}
