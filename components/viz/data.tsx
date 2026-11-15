"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Btn, Slider, Stat, Viz, fmt, hash01, useInterval } from "./ui";

const COLORS = ["#f97316", "#0ea5e9", "#22c55e", "#a855f7", "#ef4444", "#eab308", "#14b8a6", "#ec4899"];

/* ---------- Consistent hashing ---------- */
const KEYS = 90;
function owners(names: string[], vn: number): string[] {
  const ring = names.flatMap((n) => Array.from({ length: vn }, (_, v) => ({ n, pos: hash01(`${n}#${v}`) }))).sort((a, b) => a.pos - b.pos);
  return Array.from({ length: KEYS }, (_, k) => {
    const p = hash01("key" + k);
    return (ring.find((x) => x.pos >= p) ?? ring[0]).n;
  });
}
export function ConsistentHash() {
  const [names, setNames] = useState(["A", "B", "C"]);
  const [vn, setVn] = useState(1);
  const [moved, setMoved] = useState<{ ch: number; mod: number } | null>(null);
  const ring = useMemo(() => names.flatMap((n) => Array.from({ length: vn }, (_, v) => ({ n, v, pos: hash01(`${n}#${v}`) }))), [names, vn]);
  const own = useMemo(() => owners(names, vn), [names, vn]);
  const counts = names.map((n) => own.filter((o) => o === n).length);
  const change = (next: string[]) => {
    const before = owners(names, vn);
    const after = owners(next, vn);
    const ch = before.filter((b, i) => b !== after[i]).length;
    const mod = Array.from({ length: KEYS }).filter((_, k) => Math.floor(hash01("key" + k) * names.length) !== Math.floor(hash01("key" + k) * next.length)).length;
    setMoved({ ch, mod });
    setNames(next);
  };
  const cx = 130, cy = 130, R = 96;
  const pt = (pos: number, r: number) => ({ x: cx + r * Math.cos(pos * 2 * Math.PI - Math.PI / 2), y: cy + r * Math.sin(pos * 2 * Math.PI - Math.PI / 2) });
  const col = (n: string) => COLORS[(n.charCodeAt(0) - 65) % COLORS.length];
  return (
    <Viz title="Consistent hashing ring" hint="Add or remove a node and watch how few keys move compared with modulo hashing.">
      <div className="vrow">
        <Btn kind="primary" disabled={names.length >= 8} onClick={() => change([...names, String.fromCharCode(65 + names.length)])}>+ Add node</Btn>
        <Btn disabled={names.length <= 2} onClick={() => change(names.slice(0, -1))}>− Remove last</Btn>
        <span className="vsp" />
        <Slider label="Virtual nodes per server" value={vn} min={1} max={32} onChange={(v) => { setVn(v); setMoved(null); }} />
      </div>
      <div className="vsplit">
        <svg viewBox="0 0 260 260" className="ringsvg" role="img" aria-label="hash ring">
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--line)" strokeWidth="2" />
          {own.map((o, k) => { const p = pt(hash01("key" + k), R - 12); return <circle key={k} cx={p.x} cy={p.y} r="3.2" fill={col(o)} opacity="0.85" style={{ transition: "fill .5s" }} />; })}
          {ring.map((r) => { const p = pt(r.pos, R + 8); return <circle key={r.n + r.v} cx={p.x} cy={p.y} r={vn > 8 ? 3.5 : 7} fill={col(r.n)} stroke="var(--c-w)" strokeWidth="2" />; })}
          {vn <= 8 && ring.filter((r) => r.v === 0).map((r) => { const p = pt(r.pos, R + 8); return <text key={"t" + r.n} x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">{r.n}</text>; })}
          <text x={cx} y={cy - 2} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--muted)">{KEYS} keys</text>
          <text x={cx} y={cy + 13} textAnchor="middle" fontSize="10" fill="var(--muted)">{names.length} servers</text>
        </svg>
        <div>
          <div className="vstats">
            {moved ? (
              <>
                <Stat label="keys moved (consistent hashing)" value={`${moved.ch} / ${KEYS}`} tone="good" />
                <Stat label="keys moved (hash mod N)" value={`${moved.mod} / ${KEYS}`} tone="bad" />
              </>
            ) : <Stat label="add or remove a node" value="→" />}
          </div>
          <div className="loadbars">
            {names.map((n, i) => (
              <div key={n}><span style={{ color: col(n) }}>Server {n}</span><i style={{ width: `${(counts[i] / Math.max(...counts, 1)) * 100}%`, background: col(n) }} /><em>{counts[i]}</em></div>
            ))}
          </div>
          <p className="vnote">With 1 virtual node per server, load is uneven. Raise virtual nodes to 16–32 and the bars even out.</p>
        </div>
      </div>
    </Viz>
  );
}

/* ---------- Replication lag ---------- */
export function Replication() {
  const [lag, setLag] = useState(1500);
  const [leader, setLeader] = useState(1);
  const [followers, setFollowers] = useState([1, 1]);
  const [flight, setFlight] = useState([false, false]);
  const [msg, setMsg] = useState("Write a new value, then read from a follower right away.");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const write = () => {
    const v = leader + 1;
    setLeader(v);
    setFlight([true, true]);
    setMsg(`Leader committed v${v} and acknowledged the client. Replicating asynchronously…`);
    [0, 1].forEach((i) => {
      timers.current.push(setTimeout(() => {
        setFollowers((f) => { const n = [...f]; n[i] = Math.max(n[i], v); return n; });
        setFlight((f) => { const n = [...f]; n[i] = false; return n; });
      }, lag * (i === 0 ? 1 : 1.7)));
    });
  };
  const read = (i: number) => setMsg(followers[i] < leader ? `Read from follower ${i + 1} returned v${followers[i]} but the latest is v${leader}: STALE read (replication lag). Fix: read-your-writes routing.` : `Read from follower ${i + 1} returned v${followers[i]}: up to date.`);
  return (
    <Viz title="Async replication and stale reads" hint="Reads from followers can lag behind the leader.">
      <Slider label="Replication delay" value={lag} min={300} max={4000} step={100} onChange={setLag} show={(v) => v + " ms"} />
      <div className="repl">
        <div className="rnode leader"><b>Leader</b><span>v{leader}</span><small>accepts writes</small></div>
        <div className="rlinks">
          {[0, 1].map((i) => <div key={i} className="rlink"><i className={flight[i] ? "go" : ""} style={{ animationDuration: `${lag * (i ? 1.7 : 1)}ms` }} /></div>)}
        </div>
        <div className="rfollowers">
          {followers.map((v, i) => (
            <div key={i} className={`rnode ${v < leader ? "stale" : ""}`}><b>Follower {i + 1}</b><span>v{v}</span>
              <Btn onClick={() => read(i)}>Read here</Btn>
            </div>
          ))}
        </div>
      </div>
      <div className="vrow"><Btn kind="primary" onClick={write}>Write new value</Btn></div>
      <p className={`vmsg ${msg.includes("STALE") ? "bad" : ""}`}>{msg}</p>
    </Viz>
  );
}

/* ---------- Quorum ---------- */
export function Quorum() {
  const N = 5;
  const [W, setW] = useState(3);
  const [R, setR] = useState(3);
  const [ver, setVer] = useState<number[]>(new Array(N).fill(1));
  const [alive, setAlive] = useState<boolean[]>(new Array(N).fill(true));
  const [picked, setPicked] = useState<number[]>([]);
  const [latest, setLatest] = useState(1);
  const [msg, setMsg] = useState("Click replicas to fail them. Then write and read.");
  const [stat, setStat] = useState<string | null>(null);
  const pick = (k: number, al: boolean[]) => {
    const ids = al.map((a, i) => (a ? i : -1)).filter((i) => i >= 0).sort(() => Math.random() - 0.5);
    return ids.length >= k ? ids.slice(0, k) : null;
  };
  const write = () => {
    const p = pick(W, alive);
    if (!p) return setMsg(`Write FAILED: only ${alive.filter(Boolean).length} replicas alive, need W=${W}. (Consistency chosen over availability.)`);
    const v = latest + 1;
    setLatest(v);
    setVer((x) => x.map((o, i) => (p.includes(i) ? v : o)));
    setPicked(p);
    setMsg(`Wrote v${v} to replicas ${p.map((i) => i + 1).join(", ")}.`);
  };
  const read = () => {
    const p = pick(R, alive);
    if (!p) return setMsg(`Read FAILED: only ${alive.filter(Boolean).length} replicas alive, need R=${R}.`);
    const best = Math.max(...p.map((i) => ver[i]));
    setPicked(p);
    setMsg(best === latest ? `Read from ${p.map((i) => i + 1).join(", ")} returned v${best}: latest ✔` : `Read from ${p.map((i) => i + 1).join(", ")} returned v${best} but latest is v${latest}: STALE ✘`);
  };
  const trials = () => {
    let stale = 0, ok = 0;
    for (let t = 0; t < 2000; t++) {
      const w = pick(W, alive), r = pick(R, alive);
      if (!w || !r) continue;
      ok++;
      const ws = new Set(w);
      if (!r.some((i) => ws.has(i))) stale++;
    }
    setStat(ok ? `${((stale / ok) * 100).toFixed(1)}% of reads missed the latest write (${ok} trials)` : "Not enough replicas alive.");
  };
  const overlap = R + W > N;
  return (
    <Viz title="Quorum reads and writes (N = 5)" hint="R + W > N guarantees the read set overlaps the last write set.">
      <div className="vgrid2">
        <Slider label="W (write quorum)" value={W} min={1} max={N} onChange={setW} />
        <Slider label="R (read quorum)" value={R} min={1} max={N} onChange={setR} />
      </div>
      <p className={`vmsg ${overlap ? "good" : "bad"}`}>R + W = {R + W} {overlap ? "> " : "≤ "}{N}: {overlap ? "read and write quorums always overlap" : "no overlap guarantee, stale reads possible"}</p>
      <div className="qnodes">
        {ver.map((v, i) => (
          <button key={i} className={`qnode ${alive[i] ? "" : "dead"} ${picked.includes(i) ? "picked" : ""} ${v < latest ? "old" : ""}`} onClick={() => setAlive((a) => a.map((x, j) => (j === i ? !x : x)))}>
            <b>R{i + 1}</b><span>v{v}</span><small>{alive[i] ? "alive" : "down"}</small>
          </button>
        ))}
      </div>
      <div className="vrow">
        <Btn kind="primary" onClick={write}>Write</Btn>
        <Btn onClick={read}>Read</Btn>
        <Btn onClick={trials}>Run 2000 random trials</Btn>
        <Btn onClick={() => { setVer(new Array(N).fill(1)); setLatest(1); setPicked([]); setStat(null); setAlive(new Array(N).fill(true)); setMsg("Reset."); }}>Reset</Btn>
      </div>
      <p className="vmsg">{msg}</p>
      {stat && <p className="vmsg warn">{stat}</p>}
    </Viz>
  );
}

/* ---------- Bloom filter ---------- */
export function Bloom() {
  const M = 96;
  const [k, setK] = useState(3);
  const [items, setItems] = useState<string[]>([]);
  const [word, setWord] = useState("");
  const [res, setRes] = useState("");
  const idx = (w: string) => Array.from({ length: k }, (_, i) => Math.floor(hash01(w + "#" + i) * M));
  const bits = useMemo(() => { const b = new Array(M).fill(false); items.forEach((w) => idx(w).forEach((i) => (b[i] = true))); return b; }, [items, k]); // eslint-disable-line react-hooks/exhaustive-deps
  const [hl, setHl] = useState<number[]>([]);
  const add = (w: string) => { if (!w) return; setItems((x) => [...x, w]); setHl(idx(w)); setRes(`Added "${w}" → set bits ${idx(w).join(", ")}`); };
  const check = () => {
    if (!word) return;
    const ids = idx(word);
    setHl(ids);
    const all = ids.every((i) => bits[i]);
    setRes(!all ? `"${word}": DEFINITELY NOT in the set (a bit is 0).` : items.includes(word) ? `"${word}": maybe present, and it really is.` : `"${word}": maybe present, but it was never added: FALSE POSITIVE.`);
  };
  const n = items.length;
  const fp = Math.pow(1 - Math.exp((-k * n) / M), k);
  return (
    <Viz title="Bloom filter" hint="Compact set membership: no false negatives, tunable false positives.">
      <div className="vrow">
        <input className="vinput" value={word} onChange={(e) => setWord(e.target.value)} placeholder="type a word" />
        <Btn kind="primary" onClick={() => { add(word); setWord(""); }}>Add</Btn>
        <Btn onClick={check}>Check</Btn>
        <Btn onClick={() => { for (let i = 0; i < 10; i++) add("item" + (items.length + i)); }}>Add 10 random</Btn>
        <Btn onClick={() => { setItems([]); setRes(""); setHl([]); }}>Clear</Btn>
      </div>
      <Slider label="Hash functions (k)" value={k} min={1} max={6} onChange={setK} />
      <div className="bits">{bits.map((b, i) => <i key={i} className={`${b ? "set" : ""} ${hl.includes(i) ? "hl" : ""}`} />)}</div>
      <div className="vstats">
        <Stat label={`items (m = ${M} bits)`} value={String(n)} />
        <Stat label="bits set" value={`${bits.filter(Boolean).length}`} />
        <Stat label="expected false-positive rate" value={(fp * 100).toFixed(1) + "%"} tone={fp > 0.2 ? "bad" : fp > 0.05 ? "warn" : "good"} />
      </div>
      <p className="vmsg">{res || "Add some words, then check words you did and did not add."}</p>
    </Viz>
  );
}

/* ---------- Queue / partitions / consumer group ---------- */
export function Queues() {
  const P = 4;
  const [consumers, setConsumers] = useState(2);
  const [hot, setHot] = useState(false);
  const [running, setRunning] = useState(true);
  const [lag, setLag] = useState<number[]>(new Array(P).fill(0));
  const [done, setDone] = useState(0);
  const tick = useRef(0);
  useInterval(() => {
    tick.current++;
    setLag((l) => {
      const n = [...l];
      for (let m = 0; m < 3; m++) {
        const key = hot && hash01("hk" + tick.current + m) < 0.7 ? "user-1" : "user-" + Math.floor(hash01("k" + tick.current + m) * 8);
        n[Math.floor(hash01(key) * P)]++;
      }
      let processed = 0;
      for (let c = 0; c < consumers; c++) {
        const mine = Array.from({ length: P }, (_, p) => p).filter((p) => p % consumers === c);
        const withMsgs = mine.filter((p) => n[p] > 0);
        if (withMsgs.length) {
          const p = withMsgs[tick.current % withMsgs.length];
          n[p]--; processed++;
        }
      }
      setDone((d) => d + processed);
      return n;
    });
  }, 400, running);
  const total = lag.reduce((a, b) => a + b, 0);
  return (
    <Viz title="Partitioned log with a consumer group" hint="Ordering is per partition. Parallelism is capped by the number of partitions.">
      <div className="vrow">
        <Btn on={false} onClick={() => setConsumers((c) => Math.min(6, c + 1))}>+ Consumer</Btn>
        <Btn onClick={() => setConsumers((c) => Math.max(1, c - 1))}>− Consumer</Btn>
        <Btn on={hot} onClick={() => setHot((h) => !h)}>Hot key: {hot ? "ON" : "off"}</Btn>
        <Btn onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Resume"}</Btn>
        <Btn onClick={() => { setLag(new Array(P).fill(0)); setDone(0); }}>Reset</Btn>
      </div>
      <div className="qparts">
        {lag.map((l, p) => (
          <div key={p} className="qpart">
            <b>Partition {p}</b>
            <div className="qstack">{Array.from({ length: Math.min(l, 24) }).map((_, i) => <i key={i} />)}</div>
            <small>lag {l} → consumer {(p % consumers) + 1}</small>
          </div>
        ))}
      </div>
      <div className="qcons">
        {Array.from({ length: consumers }).map((_, c) => {
          const mine = Array.from({ length: P }, (_, p) => p).filter((p) => p % consumers === c);
          return <div key={c} className={`qcon ${mine.length ? "" : "idle"}`}><b>Consumer {c + 1}</b><span>{mine.length ? "owns P" + mine.join(", P") : "idle (no partition)"}</span></div>;
        })}
      </div>
      <div className="vstats">
        <Stat label="total lag" value={String(total)} tone={total > 40 ? "bad" : total > 15 ? "warn" : "good"} />
        <Stat label="processed" value={String(done)} />
      </div>
      <p className="vnote">Produce rate is 3 msg/tick; each consumer handles 1 msg/tick. Add consumers until lag stops growing; beyond {P} consumers extras sit idle. A hot key overloads one partition no matter how many consumers you add.</p>
    </Viz>
  );
}

/* ---------- Fan-out ---------- */
export function FanOut() {
  const [exp, setExp] = useState(4);
  const [mode, setMode] = useState<"write" | "read" | "hybrid">("hybrid");
  const [shot, setShot] = useState(0);
  const followers = Math.pow(10, exp);
  const following = 300;
  const threshold = 100_000;
  const pushed = mode === "write" || (mode === "hybrid" && followers < threshold);
  const writes = pushed ? followers : 1;
  const readCost = pushed ? 1 : following;
  return (
    <Viz title="News feed: fan-out on write vs read" hint="Make the author a celebrity and watch the write cost explode.">
      <div className="vrow">
        <Btn on={mode === "write"} onClick={() => setMode("write")}>Fan-out on write</Btn>
        <Btn on={mode === "read"} onClick={() => setMode("read")}>Fan-out on read</Btn>
        <Btn on={mode === "hybrid"} onClick={() => setMode("hybrid")}>Hybrid (celebrities pull)</Btn>
      </div>
      <Slider label="Author's followers" value={exp} min={1} max={7} onChange={(v) => { setExp(v); setShot(0); }} show={() => fmt(followers)} />
      <div className="vrow"><Btn kind="primary" onClick={() => setShot((s) => s + 1)}>Publish a post</Btn></div>
      <div className="dots" key={shot}>
        <span className="author">✍️</span>
        {Array.from({ length: 120 }).map((_, i) => (
          <i key={i} className={shot && pushed ? "lit" : ""} style={{ animationDelay: `${i * 18}ms` }} />
        ))}
      </div>
      <div className="vstats">
        <Stat label="feed writes per post" value={fmt(writes)} tone={writes > 100000 ? "bad" : writes > 5000 ? "warn" : "good"} />
        <Stat label="queries to open a feed" value={fmt(readCost)} tone={readCost > 100 ? "warn" : "good"} />
        <Stat label="strategy used" value={pushed ? "push" : "pull + merge"} />
      </div>
      <p className="vnote">Push makes reads trivial (one precomputed list) but a post by a user with {fmt(followers)} followers writes {fmt(followers)} feeds. Pull makes writes trivial but each feed open merges ~{following} timelines. Hybrid pushes for normal users and pulls celebrity posts at read time.</p>
    </Viz>
  );
}

/* ---------- Contention ---------- */
type Mode = "naive" | "lock" | "optimistic" | "atomic";
const SCRIPTS: Record<Mode, { who: "A" | "B"; text: string; bal: number | null }[]> = {
  naive: [
    { who: "A", text: "READ balance → 100", bal: 100 },
    { who: "B", text: "READ balance → 100", bal: 100 },
    { who: "A", text: "WRITE balance = 100 − 30 → 70", bal: 70 },
    { who: "B", text: "WRITE balance = 100 − 30 → 70 (overwrites A!)", bal: 70 },
  ],
  lock: [
    { who: "A", text: "BEGIN; SELECT … FOR UPDATE → 100 (row locked)", bal: 100 },
    { who: "B", text: "SELECT … FOR UPDATE → BLOCKED waiting for A", bal: null },
    { who: "A", text: "UPDATE balance = 70; COMMIT (lock released)", bal: 70 },
    { who: "B", text: "lock acquired, reads 70, writes 40; COMMIT", bal: 40 },
  ],
  optimistic: [
    { who: "A", text: "READ balance=100, version=7", bal: 100 },
    { who: "B", text: "READ balance=100, version=7", bal: 100 },
    { who: "A", text: "UPDATE … SET bal=70, ver=8 WHERE ver=7 → 1 row ✔", bal: 70 },
    { who: "B", text: "UPDATE … WHERE ver=7 → 0 rows ✘ (conflict). Retry: read 70 v8 → write 40 v9 ✔", bal: 40 },
  ],
  atomic: [
    { who: "A", text: "UPDATE accounts SET bal = bal − 30 WHERE id=1 AND bal ≥ 30", bal: 70 },
    { who: "B", text: "UPDATE accounts SET bal = bal − 30 WHERE id=1 AND bal ≥ 30", bal: 40 },
  ],
};
export function Contention() {
  const [mode, setMode] = useState<Mode>("naive");
  const [i, setI] = useState(-1);
  const script = SCRIPTS[mode];
  useInterval(() => setI((x) => Math.min(script.length - 1, x + 1)), 1100, i < script.length - 1 && i >= 0);
  const bal = i >= 0 ? [...script.slice(0, i + 1)].reverse().find((s) => s.bal !== null && s.text.match(/WRITE|UPDATE|COMMIT/))?.bal ?? 100 : 100;
  const finished = i === script.length - 1;
  const modes: [Mode, string][] = [["naive", "Read-modify-write (broken)"], ["lock", "Pessimistic lock"], ["optimistic", "Optimistic version check"], ["atomic", "Atomic conditional update"]];
  return (
    <Viz title="Contention: two clients spend $30 from a $100 balance" hint="Correct answer is $40. Pick a strategy and play it.">
      <div className="vrow">{modes.map(([m, l]) => <Btn key={m} on={mode === m} onClick={() => { setMode(m); setI(-1); }}>{l}</Btn>)}</div>
      <div className="vrow"><Btn kind="primary" onClick={() => setI(0)}>▶ Play</Btn><span className="vsp" /><span className="vtotal">Balance in DB: <b className={finished ? (bal === 40 ? "okc" : "badc") : ""}>${bal}</b></span></div>
      <div className="lanes">
        {(["A", "B"] as const).map((w) => (
          <div key={w} className="lane"><b>Client {w}</b>
            {script.map((s, idx) => s.who === w && <div key={idx} className={`ev ${idx <= i ? "show" : ""} ${idx === i ? "now" : ""}`} style={{ marginTop: idx * 6 }}>{s.text}</div>)}
          </div>
        ))}
      </div>
      {finished && <p className={`vmsg ${bal === 40 ? "good" : "bad"}`}>{bal === 40 ? "Correct: $40. No update was lost." : "Lost update! Final balance is $70 but $60 was spent."}</p>}
    </Viz>
  );
}

/* ---------- Proximity (grid / geohash style) ---------- */
export function Proximity() {
  const [cells, setCells] = useState(8);
  const [user, setUser] = useState({ x: 0.52, y: 0.47 });
  const pts = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ x: hash01("px" + i), y: hash01("py" + i) })), []);
  const cx = Math.min(cells - 1, Math.floor(user.x * cells));
  const cy = Math.min(cells - 1, Math.floor(user.y * cells));
  const cand = pts.filter((p) => Math.abs(Math.floor(p.x * cells) - cx) <= 1 && Math.abs(Math.floor(p.y * cells) - cy) <= 1);
  const nearest = [...cand].sort((a, b) => Math.hypot(a.x - user.x, a.y - user.y) - Math.hypot(b.x - user.x, b.y - user.y)).slice(0, 3);
  const S = 300;
  return (
    <Viz title="Proximity search with a grid index (geohash idea)" hint="Click the map to move the user. Only the 3×3 neighborhood is scanned.">
      <Slider label="Grid resolution (cells per side)" value={cells} min={2} max={16} onChange={setCells} />
      <svg viewBox={`0 0 ${S} ${S}`} className="mapsvg" onClick={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); setUser({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }); }}>
        <rect width={S} height={S} fill="var(--bg)" stroke="var(--line)" />
        {Array.from({ length: cells * cells }).map((_, i) => {
          const gx = i % cells, gy = Math.floor(i / cells);
          const near = Math.abs(gx - cx) <= 1 && Math.abs(gy - cy) <= 1;
          return <rect key={i} x={(gx * S) / cells} y={(gy * S) / cells} width={S / cells} height={S / cells} fill={near ? (gx === cx && gy === cy ? "rgba(249,115,22,.28)" : "rgba(249,115,22,.12)") : "none"} stroke="var(--line)" strokeWidth="0.6" />;
        })}
        {pts.map((p, i) => <circle key={i} cx={p.x * S} cy={p.y * S} r="3" fill={nearest.includes(p) ? "#16a34a" : cand.includes(p) ? "#ea580c" : "#c7b8a8"} />)}
        {nearest.map((p, i) => <line key={i} x1={user.x * S} y1={user.y * S} x2={p.x * S} y2={p.y * S} stroke="#16a34a" strokeDasharray="3 3" />)}
        <circle cx={user.x * S} cy={user.y * S} r="7" fill="#2563eb" stroke="#fff" strokeWidth="2" />
      </svg>
      <div className="vstats">
        <Stat label="points scanned with the grid" value={`${cand.length}`} tone="good" />
        <Stat label="points scanned without an index" value={`${pts.length}`} tone="bad" />
        <Stat label="nearest 3 (green)" value="✔" />
      </div>
      <p className="vnote">Finer cells scan fewer points but you may need more neighbor rings when results are sparse. Production systems use geohash, S2 or H3 cells stored in a normal index (or a quadtree), plus a final exact-distance sort.</p>
    </Viz>
  );
}
