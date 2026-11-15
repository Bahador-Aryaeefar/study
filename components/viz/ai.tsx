"use client";

import { useMemo, useRef, useState } from "react";
import { Btn, Flow, FlowNode, FlowStep, Slider, Stat, Viz, bytes, useInterval } from "./ui";

/* ---------- Static vs continuous batching ---------- */
const LENS = [3, 12, 4, 9, 2, 14, 5, 3, 10, 4, 7, 2, 13, 6, 3, 9, 4, 11, 2, 8, 5, 12, 3, 6];
interface Slot { id: number; rem: number; len: number }
interface Sim { slots: (Slot | null)[]; next: number; finished: number; busy: number; total: number }
const fresh = (): Sim => ({ slots: [null, null, null, null], next: 0, finished: 0, busy: 0, total: 0 });
function step(s: Sim, continuous: boolean): Sim {
  const slots = s.slots.map((x) => (x ? { ...x } : null));
  let { next, finished, busy } = s;
  const allDone = slots.every((x) => !x || x.rem === 0);
  const refill = (i: number) => { slots[i] = { id: next, rem: LENS[next % LENS.length], len: LENS[next % LENS.length] }; next++; };
  if (continuous) slots.forEach((x, i) => { if (!x || x.rem === 0) { if (x) finished++; refill(i); } });
  else if (allDone) slots.forEach((x, i) => { if (x) finished++; refill(i); });
  slots.forEach((x) => { if (x && x.rem > 0) { x.rem--; busy++; } });
  return { slots, next, finished, busy, total: s.total + 4 };
}
export function Batching() {
  const [a, setA] = useState<Sim>(fresh());
  const [b, setB] = useState<Sim>(fresh());
  const [run, setRun] = useState(true);
  useInterval(() => { setA((s) => step(s, false)); setB((s) => step(s, true)); }, 350, run);
  const lane = (title: string, s: Sim, tone: string) => (
    <div className="blane">
      <b>{title}</b>
      <div className="bslots">
        {s.slots.map((x, i) => (
          <div key={i} className={`bslot ${x && x.rem > 0 ? "busy" : "idle"}`}>
            {x ? <><span>req {x.id + 1}</span><i style={{ width: `${((x.len - x.rem) / x.len) * 100}%` }} /></> : <span>idle</span>}
          </div>
        ))}
      </div>
      <div className="vstats">
        <Stat label="requests finished" value={String(s.finished)} />
        <Stat label="GPU slot utilization" value={s.total ? Math.round((s.busy / s.total) * 100) + "%" : "–"} tone={tone as "good" | "bad"} />
      </div>
    </div>
  );
  return (
    <Viz title="Static vs continuous batching" hint="Four GPU slots. Requests need different numbers of decode steps.">
      <div className="vrow"><Btn onClick={() => setRun((r) => !r)}>{run ? "Pause" : "Resume"}</Btn><Btn onClick={() => { setA(fresh()); setB(fresh()); }}>Reset</Btn></div>
      <div className="vgrid2">{lane("Static batching", a, "bad")}{lane("Continuous batching", b, "good")}</div>
      <p className="vnote">Static batching waits for the slowest request in the batch while finished slots sit idle. Continuous batching refills a slot the moment its request ends, keeping the GPU full. This is the core idea behind vLLM-style serving.</p>
    </Viz>
  );
}

/* ---------- KV cache calculator ---------- */
const PRESETS = {
  "8B (GQA)": { layers: 32, kv: 8, mha: 32, dim: 128, weightsGB: 16, gpus: 1 },
  "70B (GQA)": { layers: 80, kv: 8, mha: 64, dim: 128, weightsGB: 140, gpus: 4 },
} as const;
export function KvCache() {
  const [p, setP] = useState<keyof typeof PRESETS>("70B (GQA)");
  const [mha, setMha] = useState(false);
  const [ctx, setCtx] = useState(8000);
  const [fp8, setFp8] = useState(false);
  const c = PRESETS[p];
  const kv = mha ? c.mha : c.kv;
  const perTok = 2 * c.layers * kv * c.dim * (fp8 ? 1 : 2);
  const perReq = perTok * ctx;
  const gpuMem = c.gpus * 80e9 * 0.9;
  const free = gpuMem - c.weightsGB * 1e9;
  const maxReq = Math.max(0, Math.floor(free / perReq));
  const wPct = Math.min(100, (c.weightsGB * 1e9 / gpuMem) * 100);
  return (
    <Viz title="KV cache memory calculator" hint="Why serving capacity is limited by memory, not FLOPs.">
      <div className="vrow">
        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => <Btn key={k} on={p === k} onClick={() => setP(k)}>{k}</Btn>)}
        <Btn on={mha} onClick={() => setMha((m) => !m)}>Full multi-head KV: {mha ? "yes" : "no (GQA)"}</Btn>
        <Btn on={fp8} onClick={() => setFp8((m) => !m)}>FP8 KV cache: {fp8 ? "yes" : "no (fp16)"}</Btn>
      </div>
      <Slider label="Context length per request (tokens)" value={ctx} min={500} max={128000} step={500} onChange={setCtx} show={(v) => v.toLocaleString()} />
      <div className="membar" title="GPU memory">
        <span className="w" style={{ width: `${wPct}%` }}>weights {c.weightsGB} GB</span>
        <span className="k" style={{ width: `${Math.min(100 - wPct, Math.max(0, ((maxReq * perReq) / gpuMem) * 100))}%` }}>KV for {maxReq} req</span>
      </div>
      <div className="vstats">
        <Stat label="KV cache per token" value={bytes(perTok)} />
        <Stat label={`KV cache per request (${ctx.toLocaleString()} tok)`} value={bytes(perReq)} tone="warn" />
        <Stat label={`GPU memory (${c.gpus}× 80 GB, 90% usable)`} value={bytes(gpuMem)} />
        <Stat label="max concurrent requests" value={String(maxReq)} tone={maxReq < 8 ? "bad" : "good"} />
      </div>
      <p className="vnote">per token = 2 (K and V) × layers × kv_heads × head_dim × bytes. Grouped-query attention cuts kv_heads, FP8 halves bytes, and PagedAttention avoids wasting memory to fragmentation. Try switching GQA off to see capacity collapse.</p>
    </Viz>
  );
}

/* ---------- RAG pipeline + ranking lab ---------- */
const DOCS = [
  { id: "A", t: "Refund policy 2022 (outdated)", dense: 1, bm25: 4, rel: 2 },
  { id: "B", t: "Refund policy 2024 (current) ★ answer", dense: 5, bm25: 2, rel: 1 },
  { id: "C", t: "Shipping times by region", dense: 2, bm25: 6, rel: 6 },
  { id: "D", t: "How to print a return label", dense: 3, bm25: 1, rel: 3 },
  { id: "E", t: "Pricing FAQ", dense: 4, bm25: 5, rel: 5 },
  { id: "F", t: "Warranty terms", dense: 6, bm25: 3, rel: 4 },
];
export function RagPipeline() {
  const [mode, setMode] = useState<"dense" | "bm25" | "rrf" | "rerank">("dense");
  const nodes: FlowNode[] = [
    { id: "q", label: "Query", icon: "❓" }, { id: "rw", label: "Rewrite", icon: "✏️" }, { id: "ret", label: "Hybrid retrieve", icon: "🔎" },
    { id: "fuse", label: "Fuse (RRF)", icon: "🔀" }, { id: "rr", label: "Rerank", icon: "📶" }, { id: "pack", label: "Pack context", icon: "📦" }, { id: "llm", label: "LLM", icon: "🧠" }, { id: "ans", label: "Cited answer", icon: "✅" },
  ];
  const steps: FlowStep[] = [
    { at: "q", note: "User: 'refund window for annual plan?'", ms: 0 },
    { at: "rw", note: "Rewrite with chat context into a standalone query; maybe generate 2-3 variants", ms: 250 },
    { at: "ret", note: "Run dense (embeddings) and sparse (BM25) search in parallel, each with the tenant/ACL filter. Take top 50 from each", ms: 60 },
    { at: "fuse", note: "Reciprocal rank fusion merges rankings without calibrating scores", ms: 2 },
    { at: "rr", note: "Cross-encoder rereads query + passage pairs and reorders the top 50", ms: 120 },
    { at: "pack", note: "Pick top 6-8 passages, order them, add metadata, respect the token budget", ms: 3 },
    { at: "llm", note: "Generate grounded in context; instructed to say 'not found' when evidence is missing", ms: 1500 },
    { at: "ans", note: "Return answer with citations back to chunks; log retrieved ids for evals", ms: 5, tone: "good" },
  ];
  const order = useMemo(() => {
    const rrf = (d: (typeof DOCS)[number]) => 1 / (60 + d.dense) + 1 / (60 + d.bm25);
    const s = [...DOCS];
    if (mode === "dense") s.sort((a, b) => a.dense - b.dense);
    if (mode === "bm25") s.sort((a, b) => a.bm25 - b.bm25);
    if (mode === "rrf") s.sort((a, b) => rrf(b) - rrf(a));
    if (mode === "rerank") s.sort((a, b) => a.rel - b.rel);
    return s;
  }, [mode]);
  const goldPos = order.findIndex((d) => d.id === "B") + 1;
  const modes: ["dense" | "bm25" | "rrf" | "rerank", string][] = [["dense", "Dense only"], ["bm25", "BM25 only"], ["rrf", "Hybrid (RRF)"], ["rerank", "Hybrid + reranker"]];
  return (
    <Viz title="RAG query pipeline" hint="Play the stages, then compare retrieval strategies below.">
      <Flow nodes={nodes} steps={steps} />
      <div className="vsep" />
      <div className="vrow"><b className="vlabel">Ranking lab: query 'refund window for annual plan'</b></div>
      <div className="vrow">{modes.map(([m, l]) => <Btn key={m} on={mode === m} onClick={() => setMode(m)}>{l}</Btn>)}</div>
      <ol className="rank">
        {order.map((d, i) => <li key={d.id} className={`${d.id === "B" ? "gold" : ""} ${i < 3 ? "top" : ""}`}><span>{i + 1}</span>{d.t}</li>)}
      </ol>
      <p className={`vmsg ${goldPos <= 3 ? "good" : "bad"}`}>Correct document is at position {goldPos}: recall@3 {goldPos <= 3 ? "✔" : "✘"}{goldPos === 1 ? " (best)" : ""}</p>
      <p className="vnote">Dense search captures meaning but misses exact terms; BM25 does the opposite. Fusion makes the system robust, and the reranker (more expensive, so applied to a short list) fixes the final order.</p>
    </Viz>
  );
}

/* ---------- Agent loop ---------- */
interface Ev { k: "user" | "think" | "tool" | "result" | "error" | "guard" | "final"; text: string; tok: number }
const SCEN: Record<string, { label: string; ev: Ev[] }> = {
  happy: { label: "Happy path", ev: [
    { k: "user", text: "Why did checkout errors spike at 14:00?", tok: 40 },
    { k: "think", text: "I should query error logs around 14:00 first.", tok: 120 },
    { k: "tool", text: "search_logs(service='checkout', from='13:50', to='14:10')", tok: 60 },
    { k: "result", text: "412 errors: 'payment-gateway timeout' (98%)", tok: 300 },
    { k: "think", text: "Check what changed on payment-gateway near 14:00.", tok: 100 },
    { k: "tool", text: "get_deploys(service='payment-gateway', around='14:00')", tok: 50 },
    { k: "result", text: "Deploy v2.31 at 13:58 changed timeout 5s → 500ms", tok: 200 },
    { k: "final", text: "Root cause: v2.31 lowered the timeout. Recommend rollback. (cites 2 tool results)", tok: 180 },
  ] },
  recover: { label: "Tool error → recovery", ev: [
    { k: "user", text: "Summarize ticket T-1042", tok: 30 },
    { k: "tool", text: "get_ticket(id='1042')", tok: 40 },
    { k: "error", text: "Error: ticket ids look like 'T-1042'", tok: 40 },
    { k: "think", text: "The error message told me the format. Retry with the right id.", tok: 80 },
    { k: "tool", text: "get_ticket(id='T-1042')", tok: 40 },
    { k: "result", text: "Thread with 6 messages…", tok: 500 },
    { k: "final", text: "Summary: customer cannot reset SSO; fix pending in release 4.2.", tok: 150 },
  ] },
  loop: { label: "Loop trap → budget stops it", ev: [
    { k: "user", text: "Find the config file for the billing job", tok: 30 },
    { k: "tool", text: "search_files('billing.yaml')", tok: 40 },
    { k: "result", text: "No matches", tok: 20 },
    { k: "tool", text: "search_files('billing.yaml')", tok: 40 },
    { k: "result", text: "No matches", tok: 20 },
    { k: "tool", text: "search_files('billing.yaml')", tok: 40 },
    { k: "guard", text: "Loop detector: same call 3× → inject 'try a different approach'", tok: 0 },
    { k: "think", text: "Search by content instead of filename.", tok: 80 },
    { k: "tool", text: "grep('billing_job', '*.yml')", tok: 40 },
    { k: "result", text: "config/jobs/billing.yml:1", tok: 60 },
    { k: "final", text: "Found: config/jobs/billing.yml", tok: 60 },
  ] },
  approval: { label: "Human approval gate", ev: [
    { k: "user", text: "Refund order 8841 and email the customer", tok: 40 },
    { k: "tool", text: "get_order(8841)", tok: 40 },
    { k: "result", text: "Paid $240, delivered 12 days ago", tok: 120 },
    { k: "guard", text: "Policy: refunds over $100 need approval. Run paused, awaiting a human", tok: 0 },
    { k: "guard", text: "Human approves exact payload: refund(8841, $240)", tok: 0 },
    { k: "tool", text: "refund(order=8841, amount=240, idempotency_key='run42-step4')", tok: 50 },
    { k: "result", text: "refund_id=R-77 status=ok", tok: 40 },
    { k: "final", text: "Refunded $240 and queued the email.", tok: 80 },
  ] },
};
export function AgentLoop() {
  const [sc, setSc] = useState("happy");
  const [i, setI] = useState(-1);
  const evs = SCEN[sc].ev;
  useInterval(() => setI((x) => Math.min(evs.length - 1, x + 1)), 900, i >= 0 && i < evs.length - 1);
  const shown = evs.slice(0, i + 1);
  const tokens = shown.reduce((a, e) => a + e.tok, 0);
  const steps = shown.filter((e) => e.k === "tool").length;
  const icon: Record<Ev["k"], string> = { user: "👤", think: "💭", tool: "🔧", result: "📥", error: "⚠️", guard: "🛡️", final: "✅" };
  return (
    <Viz title="The agent loop with guardrails" hint="Pick a scenario and play it. Watch the budget meters and what the model sees.">
      <div className="vrow">{Object.entries(SCEN).map(([k, v]) => <Btn key={k} on={sc === k} onClick={() => { setSc(k); setI(-1); }}>{v.label}</Btn>)}<span className="vsp" /><Btn kind="primary" onClick={() => setI(0)}>▶ Play</Btn></div>
      <div className="vstats">
        <Stat label="tool calls (max 8)" value={`${steps}/8`} tone={steps > 6 ? "bad" : "good"} />
        <Stat label="tokens used (budget 60k)" value={tokens.toLocaleString()} />
        <Stat label="status" value={i < 0 ? "idle" : i === evs.length - 1 ? "done" : "running"} />
      </div>
      <ul className="trace">
        {shown.map((e, idx) => <li key={idx} className={`${e.k} ${idx === i ? "now" : ""}`}><span>{icon[e.k]}</span><b>{e.k}</b><em>{e.text}</em></li>)}
      </ul>
      <p className="vnote">Loop: model decides → tool runs → result goes back into context → repeat until it answers or a limit fires. Guardrails live outside the model: budgets, loop detection, policy checks, approvals and idempotency keys.</p>
    </Viz>
  );
}
