"use client";

import { useMemo, useRef, useState } from "react";
import { Btn, Slider, Stat, Viz, useInterval } from "./ui";

/* ---------- Token bucket ---------- */
export function TokenBucket() {
  const CAP = 10;
  const [rate, setRate] = useState(3);
  const [tokens, setTokens] = useState(CAP);
  const [ok, setOk] = useState(0);
  const [no, setNo] = useState(0);
  const [log, setLog] = useState<boolean[]>([]);
  const [auto, setAuto] = useState(false);
  const tRef = useRef(CAP);
  const send = (n = 1) => {
    const res: boolean[] = [];
    for (let i = 0; i < n; i++) {
      if (tRef.current >= 1) { tRef.current -= 1; res.push(true); } else res.push(false);
    }
    setTokens(tRef.current);
    setOk((x) => x + res.filter(Boolean).length);
    setNo((x) => x + res.filter((r) => !r).length);
    setLog((l) => [...l, ...res].slice(-48));
  };
  useInterval(() => {
    tRef.current = Math.min(CAP, tRef.current + rate / 10);
    setTokens(tRef.current);
  }, 100);
  useInterval(() => send(1), 200, auto);
  const level = (tokens / CAP) * 100;
  return (
    <Viz title="Token bucket rate limiter" hint="Bursts are allowed up to the bucket size; the long-run rate is the refill rate.">
      <Slider label="Refill rate (tokens/s)" value={rate} min={1} max={10} onChange={setRate} />
      <div className="vsplit">
        <div className="bucket">
          <div className="bucket-water" style={{ height: `${level}%` }} />
          <b>{tokens.toFixed(1)} / {CAP}</b>
        </div>
        <div>
          <div className="vrow">
            <Btn kind="primary" onClick={() => send(1)}>Send 1 request</Btn>
            <Btn kind="danger" onClick={() => send(15)}>Burst of 15</Btn>
            <Btn on={auto} onClick={() => setAuto((a) => !a)}>Steady 5 req/s: {auto ? "ON" : "off"}</Btn>
          </div>
          <div className="vstats">
            <Stat label="allowed" value={String(ok)} tone="good" />
            <Stat label="rejected (429)" value={String(no)} tone="bad" />
          </div>
          <div className="dotlog">{log.map((r, i) => <i key={i} className={r ? "ok" : "no"} />)}</div>
        </div>
      </div>
      <p className="vnote">Steady 5 req/s with a 3 tokens/s refill drains the bucket, then roughly 40% get rejected. Sliding-window and leaky-bucket variants trade burstiness for smoother output.</p>
    </Viz>
  );
}

/* ---------- Circuit breaker ---------- */
type CB = "closed" | "open" | "half";
export function CircuitBreaker() {
  const [healthy, setHealthy] = useState(true);
  const [state, setState] = useState<CB>("closed");
  const [recent, setRecent] = useState<("ok" | "fail" | "ff")[]>([]);
  const [passed, setPassed] = useState(0);
  const [fast, setFast] = useState(0);
  const st = useRef({ openFor: 0, halfOk: 0, window: [] as boolean[] });
  useInterval(() => {
    const s = st.current;
    let cur = state;
    if (cur === "open") {
      s.openFor++;
      if (s.openFor >= 8) { cur = "half"; s.halfOk = 0; setState("half"); }
      else { setFast((f) => f + 1); setRecent((r) => [...r, "ff" as const].slice(-30)); return; }
    }
    const success = healthy;
    setPassed((p) => p + 1);
    setRecent((r) => [...r, success ? ("ok" as const) : ("fail" as const)].slice(-30));
    if (cur === "half") {
      if (!success) { s.openFor = 0; setState("open"); }
      else { s.halfOk++; if (s.halfOk >= 2) { s.window = []; setState("closed"); } }
      return;
    }
    s.window = [...s.window, success].slice(-10);
    if (s.window.filter((x) => !x).length >= 5) { s.openFor = 0; setState("open"); }
  }, 450);
  const box = (k: CB, label: string, sub: string) => <div className={`cbbox ${state === k ? "on " + k : ""}`}><b>{label}</b><small>{sub}</small></div>;
  return (
    <Viz title="Circuit breaker" hint="Break the dependency, then heal it, and watch the state machine.">
      <div className="vrow">
        <Btn on={!healthy} kind={healthy ? undefined : "danger"} onClick={() => setHealthy((h) => !h)}>Dependency: {healthy ? "healthy" : "FAILING"}</Btn>
        <Btn onClick={() => { setRecent([]); setPassed(0); setFast(0); setState("closed"); st.current = { openFor: 0, halfOk: 0, window: [] }; }}>Reset</Btn>
      </div>
      <div className="cbrow">
        {box("closed", "CLOSED", "requests flow, failures counted")}
        <span>→ ≥5 failures in last 10 →</span>
        {box("open", "OPEN", "fail fast for ~3.6 s")}
        <span>→ cool-down →</span>
        {box("half", "HALF-OPEN", "2 trial calls")}
      </div>
      <div className="dotlog">{recent.map((r, i) => <i key={i} className={r === "ok" ? "ok" : r === "fail" ? "no" : "ff"} title={r} />)}</div>
      <div className="vstats">
        <Stat label="calls sent to dependency" value={String(passed)} />
        <Stat label="fast-failed (protected)" value={String(fast)} tone="good" />
      </div>
      <p className="vnote">green = success · red = real failure · grey = rejected instantly by the breaker. While open, the struggling service gets breathing room and callers get a fast fallback instead of piling up on timeouts.</p>
    </Viz>
  );
}

/* ---------- Retry storm ---------- */
type RMode = "naive" | "exp" | "jitter";
function simulate(mode: RMode): { load: number[]; attempts: number; recovered: number } {
  const CAP = 20, TICKS = 40;
  type Req = { next: number; tries: number };
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let reqs: Req[] = [];
  const load: number[] = [];
  let attempts = 0;
  let lastBacklog = -1;
  for (let t = 0; t < TICKS; t++) {
    if (t < 30) for (let i = 0; i < 10; i++) reqs.push({ next: t, tries: 0 });
    const due = reqs.filter((r) => r.next <= t);
    const rest = reqs.filter((r) => r.next > t);
    const down = t >= 4 && t < 10;
    const eff = down ? 0 : due.length > CAP * 3 ? CAP * 0.35 : CAP;
    load.push(due.length);
    attempts += due.length;
    const accepted = Math.floor(eff);
    const failed = due.slice(accepted);
    failed.forEach((r) => {
      r.tries++;
      const base = Math.min(16, 2 ** r.tries);
      r.next = t + (mode === "naive" ? 1 : mode === "exp" ? base : 1 + Math.floor(rnd() * base));
    });
    reqs = [...rest, ...failed];
    lastBacklog = reqs.length;
    if (t > 12 && due.length <= CAP && reqs.filter((r) => r.next <= t + 1).length <= CAP && lastBacklog <= CAP * 1.5 && t >= 30) { /* settled */ }
  }
  const recoveredAt = load.findIndex((l, i) => i >= 10 && l <= CAP);
  return { load, attempts, recovered: recoveredAt };
}
export function RetryStorm() {
  const [mode, setMode] = useState<RMode>("naive");
  const [shown, setShown] = useState(0);
  const sim = useMemo(() => simulate(mode), [mode]);
  useInterval(() => setShown((s) => Math.min(sim.load.length, s + 1)), 140, shown < sim.load.length);
  const max = Math.max(...sim.load, 40);
  const modes: [RMode, string][] = [["naive", "Retry immediately"], ["exp", "Exponential backoff"], ["jitter", "Backoff + full jitter"]];
  return (
    <Viz title="Retry storms" hint="Server capacity is 20/tick. It is down for ticks 4–9, then recovers. Replay each retry policy.">
      <div className="vrow">{modes.map(([m, l]) => <Btn key={m} on={mode === m} onClick={() => { setMode(m); setShown(0); }}>{l}</Btn>)}</div>
      <svg viewBox="0 0 400 150" className="chart">
        <line x1="0" x2="400" y1={140 - (20 / max) * 130} y2={140 - (20 / max) * 130} stroke="#16a34a" strokeDasharray="4 3" />
        <text x="4" y={140 - (20 / max) * 130 - 4} fontSize="9" fill="#16a34a">capacity 20</text>
        <rect x={4 * 10 + 2} y="0" width={60} height="140" fill="rgba(239,68,68,.08)" />
        <text x={4 * 10 + 6} y="12" fontSize="9" fill="#ef4444">outage</text>
        {sim.load.slice(0, shown).map((l, i) => <rect key={i} x={i * 10 + 2} y={140 - (l / max) * 130} width="8" height={(l / max) * 130} rx="2" fill={l > 20 ? "#ef4444" : "#f97316"} />)}
      </svg>
      <div className="vstats">
        <Stat label="peak requests in one tick" value={String(Math.max(...sim.load.slice(0, shown), 0))} tone="warn" />
        <Stat label="total attempts (wasted work)" value={String(sim.load.slice(0, shown).reduce((a, b) => a + b, 0))} />
        <Stat label="back under capacity at tick" value={sim.recovered < 0 ? "never" : String(sim.recovered)} tone={sim.recovered < 0 || sim.recovered > 20 ? "bad" : "good"} />
      </div>
      <p className="vnote">Immediate retries synchronize clients into waves that keep the server over capacity (it degrades when overloaded, so recovery stalls). Backoff spreads load in time; jitter de-synchronizes the clients so they do not retry in lock-step.</p>
    </Viz>
  );
}

/* ---------- Saga ---------- */
const STEPS = ["Reserve inventory", "Charge payment", "Create shipment", "Send confirmation"];
const UNDO = ["Release inventory", "Refund payment", "Cancel shipment", "—"];
export function Saga() {
  const [failAt, setFailAt] = useState<number>(2);
  const [events, setEvents] = useState<{ i: number; s: "done" | "failed" | "undone" }[]>([]);
  const [pos, setPos] = useState(0);
  const run = () => {
    const ev: { i: number; s: "done" | "failed" | "undone" }[] = [];
    for (let i = 0; i < STEPS.length; i++) {
      if (i === failAt) { ev.push({ i, s: "failed" }); for (let j = i - 1; j >= 0; j--) ev.push({ i: j, s: "undone" }); break; }
      ev.push({ i, s: "done" });
    }
    setEvents(ev); setPos(0);
  };
  useInterval(() => setPos((p) => Math.min(events.length, p + 1)), 800, pos < events.length);
  const status = (i: number) => {
    type St = "idle" | "done" | "failed" | "undone";
    let s = "idle" as St;
    for (const e of events.slice(0, pos)) if (e.i === i) s = e.s as St;
    return s;
  };
  return (
    <Viz title="Saga with compensations" hint="No distributed transaction: each step has an undo. Pick where it fails.">
      <div className="vrow">
        {[...STEPS, "no failure"].map((s, i) => <Btn key={i} on={failAt === (i === STEPS.length ? -1 : i)} onClick={() => setFailAt(i === STEPS.length ? -1 : i)}>{i === STEPS.length ? "No failure" : "Fail at: " + s}</Btn>)}
        <span className="vsp" /><Btn kind="primary" onClick={run}>▶ Run</Btn>
      </div>
      <div className="saga">
        {STEPS.map((s, i) => (
          <div key={s} className={`sstep ${status(i)}`}>
            <b>{i + 1}. {s}</b>
            <small>{status(i) === "done" ? "✔ committed" : status(i) === "failed" ? "✘ failed" : status(i) === "undone" ? `↩ ${UNDO[i]}` : "pending"}</small>
          </div>
        ))}
      </div>
      <p className="vnote">Compensations must be idempotent and retryable, and intermediate states are visible to users (an order that is 'paid' but not yet 'shipped'). Orchestration (a coordinator drives steps) is easier to reason about than choreography (services react to events).</p>
    </Viz>
  );
}

/* ---------- Raft ---------- */
interface RNode { id: number; role: "F" | "C" | "L"; term: number; timeout: number; alive: boolean; log: number; commit: number }
const N = 5;
const rt = () => 5 + Math.floor(Math.random() * 5);
const init = (): RNode[] => Array.from({ length: N }, (_, id) => ({ id, role: "F", term: 0, timeout: 3 + id * 2, alive: true, log: 0, commit: 0 }));
export function Raft() {
  const [nodes, setNodes] = useState<RNode[]>(init());
  const [events, setEvents] = useState<string[]>(["Cluster started. Followers wait for a heartbeat."]);
  const [beat, setBeat] = useState(0);
  const say = (m: string) => setEvents((e) => [m, ...e].slice(0, 7));
  useInterval(() => {
    setNodes((prev) => {
      const ns = prev.map((n) => ({ ...n }));
      const alive = ns.filter((n) => n.alive);
      const leader = alive.filter((n) => n.role === "L").sort((a, b) => b.term - a.term)[0];
      if (leader) {
        let have = 0;
        alive.forEach((f) => {
          if (f.id === leader.id) { have++; return; }
          f.timeout = rt(); f.term = Math.max(f.term, leader.term); f.role = "F";
          if (f.log < leader.log) f.log++;
          if (f.log >= leader.log) have++;
        });
        if (have * 2 > N && leader.commit < leader.log) { leader.commit = leader.log; say(`Entry ${leader.log} replicated to a majority: COMMITTED.`); }
        alive.forEach((f) => { if (f.id !== leader.id) f.commit = Math.min(f.log, leader.commit); });
        setBeat((b) => b + 1);
        return ns;
      }
      alive.forEach((n) => { n.timeout--; });
      const order = alive.filter((n) => n.timeout <= 0).sort(() => Math.random() - 0.5);
      for (const c of order) {
        const cur = ns[c.id];
        if (cur.timeout > 0 || !cur.alive) continue;
        const term = Math.max(...ns.map((x) => x.term)) + 1;
        cur.role = "C"; cur.term = term; cur.timeout = rt();
        let votes = 1;
        ns.forEach((o) => { if (o.alive && o.id !== cur.id && o.term < term && cur.log >= o.log) { votes++; o.term = term; o.role = "F"; o.timeout = rt(); } });
        if (votes * 2 > N) { cur.role = "L"; say(`N${cur.id + 1} won the election for term ${term} with ${votes}/${N} votes.`); }
        else say(`N${cur.id + 1} started term ${term} but only got ${votes} vote(s): no quorum.`);
      }
      return ns;
    });
  }, 700);
  const send = () => setNodes((p) => { const ns = p.map((n) => ({ ...n })); const l = ns.find((n) => n.alive && n.role === "L"); if (!l) { say("No leader: the command is rejected."); return p; } l.log++; say(`Client command appended to leader N${l.id + 1} log (entry ${l.log}).`); return ns; });
  const toggle = (id: number) => setNodes((p) => p.map((n) => (n.id === id ? { ...n, alive: !n.alive, role: n.alive ? n.role : "F", timeout: rt() } : n)));
  const alive = nodes.filter((n) => n.alive).length;
  const pos = (i: number) => ({ x: 170 + 120 * Math.cos((i / N) * 2 * Math.PI - Math.PI / 2), y: 140 + 100 * Math.sin((i / N) * 2 * Math.PI - Math.PI / 2) });
  const leader = nodes.find((n) => n.alive && n.role === "L");
  return (
    <Viz title="Raft: leader election and log replication" hint="Click a node to crash or revive it. Crash the leader and watch a new election.">
      <div className="vrow">
        <Btn kind="primary" onClick={send}>Send client command</Btn>
        <Btn kind="danger" disabled={!leader} onClick={() => leader && toggle(leader.id)}>Crash the leader</Btn>
        <Btn onClick={() => { setNodes(init()); setEvents(["Reset."]); }}>Reset</Btn>
        <span className="vsp" /><span className="vtotal">{alive}/{N} alive · quorum needs 3</span>
      </div>
      <svg viewBox="0 0 340 280" className="raftsvg">
        {leader && nodes.filter((n) => n.alive && n.id !== leader.id).map((n) => <line key={n.id} x1={pos(leader.id).x} y1={pos(leader.id).y} x2={pos(n.id).x} y2={pos(n.id).y} stroke="#f97316" strokeWidth="2" strokeDasharray="5 6" className={beat % 2 ? "hbA" : "hbB"} />)}
        {nodes.map((n) => {
          const p = pos(n.id);
          const fill = !n.alive ? "var(--c-g1)" : n.role === "L" ? "#f97316" : n.role === "C" ? "#fde68a" : "var(--c-w)";
          return (
            <g key={n.id} onClick={() => toggle(n.id)} style={{ cursor: "pointer" }}>
              <circle cx={p.x} cy={p.y} r="30" fill={fill} stroke={n.role === "L" && n.alive ? "#ea580c" : "var(--c-bd2)"} strokeWidth="3" />
              <text x={p.x} y={p.y - 3} textAnchor="middle" fontWeight="800" fontSize="13" fill={n.role === "L" && n.alive ? "#fff" : "var(--text)"}>N{n.id + 1}{n.role === "L" && n.alive ? " ★" : ""}</text>
              <text x={p.x} y={p.y + 11} textAnchor="middle" fontSize="9.5" fill={n.role === "L" && n.alive ? "#fff" : "var(--muted)"}>{n.alive ? `term ${n.term}` : "crashed"}</text>
              {Array.from({ length: Math.min(n.log, 8) }).map((_, k) => <rect key={k} x={p.x - 24 + k * 6.5} y={p.y + 36} width="5" height="8" rx="1" fill={k < n.commit ? "#16a34a" : "#fb923c"} />)}
              {n.alive && n.role === "C" && <text x={p.x} y={p.y - 36} textAnchor="middle" fontSize="9" fill="#b45309">candidate</text>}
            </g>
          );
        })}
      </svg>
      <p className="vnote">Small bars under each node are its log: orange = stored but not yet committed, green = committed (on a majority). With only 2 nodes alive no leader can be elected: consistency over availability.</p>
      <ul className="evlog">{events.map((e, i) => <li key={i}>{e}</li>)}</ul>
    </Viz>
  );
}
