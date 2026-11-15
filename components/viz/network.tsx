"use client";

import { useMemo, useRef, useState } from "react";
import { Btn, Flow, FlowNode, FlowStep, Slider, Stat, Viz, bytes, fmt, hash01, useInterval } from "./ui";

/* ---------- Life of a request ---------- */
export function RequestPath() {
  const [cdnHit, setCdnHit] = useState(false);
  const [cacheHit, setCacheHit] = useState(false);
  const nodes: FlowNode[] = [
    { id: "client", label: "Client", icon: "💻" },
    { id: "dns", label: "DNS", icon: "📖" },
    { id: "cdn", label: "CDN", icon: "🌐" },
    { id: "lb", label: "Load balancer", icon: "⚖️" },
    { id: "app", label: "App server", icon: "🖥️" },
    { id: "cache", label: "Cache", icon: "⚡" },
    { id: "db", label: "Database", icon: "🗄️" },
  ];
  const steps: FlowStep[] = useMemo(() => {
    if (cdnHit)
      return [
        { at: "client", note: "Browser resolves the name (cached locally, 0 ms)", ms: 0 },
        { at: "cdn", note: "Nearest edge has the object. Served from memory/SSD at the edge.", ms: 20, tone: "good" },
        { at: "client", note: "Response rendered. No origin traffic at all.", ms: 10, tone: "good" },
      ];
    const s: FlowStep[] = [
      { at: "client", note: "Client needs api.example.com", ms: 0 },
      { at: "dns", note: "DNS lookup (recursive resolver, may be cached by TTL)", ms: 25 },
      { at: "cdn", note: "Edge miss, forwards to origin over a warm connection", ms: 15, tone: "warn" },
      { at: "lb", note: "L7 load balancer terminates TLS and picks a healthy app server", ms: 5 },
      { at: "app", note: "App authenticates and checks cache first", ms: 5 },
    ];
    if (cacheHit) s.push({ at: "cache", note: "Cache hit. Sub-millisecond read.", ms: 1, tone: "good" });
    else {
      s.push({ at: "cache", note: "Cache miss", ms: 1, tone: "warn" });
      s.push({ at: "db", note: "Query the database (index lookup + disk/page cache)", ms: 12 });
      s.push({ at: "cache", note: "Populate cache with a TTL (cache-aside)", ms: 1 });
    }
    s.push({ at: "app", note: "Serialize the response", ms: 3 });
    s.push({ at: "client", note: "Response travels back through LB and CDN", ms: 20, tone: "good" });
    return s;
  }, [cdnHit, cacheHit]);
  return (
    <Viz title="Life of a request" hint="Toggle where the request is served from, then press Play.">
      <div className="vrow">
        <Btn on={cdnHit} onClick={() => setCdnHit((v) => !v)}>CDN hit: {cdnHit ? "yes" : "no"}</Btn>
        <Btn on={cacheHit} disabled={cdnHit} onClick={() => setCacheHit((v) => !v)}>App cache hit: {cacheHit ? "yes" : "no"}</Btn>
      </div>
      <Flow nodes={nodes} steps={steps} />
    </Viz>
  );
}

/* ---------- Back-of-envelope estimator ---------- */
export function Estimator() {
  const [dau, setDau] = useState(10_000_000);
  const [reqs, setReqs] = useState(20);
  const [writePct, setWritePct] = useState(10);
  const [kb, setKb] = useState(2);
  const [years, setYears] = useState(5);
  const [peak, setPeak] = useState(3);
  const [perServer, setPerServer] = useState(500);
  const total = dau * reqs;
  const qps = total / 86400;
  const peakQps = qps * peak;
  const writes = (qps * writePct) / 100;
  const perYear = (total * (writePct / 100) * kb * 1000 * 365);
  return (
    <Viz title="Back-of-envelope estimator" hint="Drag sliders to see how assumptions change the architecture.">
      <div className="vgrid2">
        <Slider label="Daily active users" value={dau} min={100_000} max={500_000_000} step={100_000} onChange={setDau} show={fmt} />
        <Slider label="Requests / user / day" value={reqs} min={1} max={200} onChange={setReqs} />
        <Slider label="Write share" value={writePct} min={1} max={100} onChange={setWritePct} show={(v) => v + "%"} />
        <Slider label="Payload per write (KB)" value={kb} min={1} max={500} onChange={setKb} />
        <Slider label="Retention (years)" value={years} min={1} max={10} onChange={setYears} />
        <Slider label="Peak / average" value={peak} min={1} max={10} onChange={setPeak} show={(v) => v + "x"} />
        <Slider label="Requests/s one server handles" value={perServer} min={50} max={5000} step={50} onChange={setPerServer} />
      </div>
      <div className="vstats">
        <Stat label="average QPS" value={fmt(qps)} />
        <Stat label="peak QPS" value={fmt(peakQps)} tone="warn" />
        <Stat label="write QPS (avg)" value={fmt(writes)} />
        <Stat label="new data / year" value={bytes(perYear)} />
        <Stat label={`storage in ${years}y (x3 replicas)`} value={bytes(perYear * years * 3)} tone="warn" />
        <Stat label="app servers at peak (+30%)" value={Math.ceil((peakQps / perServer) * 1.3).toString()} tone="good" />
        <Stat label="egress at peak (reads x 2KB)" value={bytes(peakQps * 2000) + "/s"} />
      </div>
      <p className="vnote">Rule of thumb: 1M requests/day ≈ 12 QPS. A single Postgres primary handles roughly 5–20k simple QPS, so above that you need caching, replicas or sharding.</p>
    </Viz>
  );
}

/* ---------- Load balancer ---------- */
type Algo = "rr" | "random" | "least" | "hash";
export function LoadBalancer() {
  const N = 4;
  const [algo, setAlgo] = useState<Algo>("rr");
  const [running, setRunning] = useState(true);
  const [, force] = useState(0);
  const st = useRef({ rr: 0, tick: 0, servers: Array.from({ length: N }, () => [] as number[]), served: new Array(N).fill(0) as number[] });
  const reset = () => { st.current = { rr: 0, tick: 0, servers: Array.from({ length: N }, () => []), served: new Array(N).fill(0) }; force((x) => x + 1); };
  useInterval(() => {
    const s = st.current;
    s.tick++;
    s.servers = s.servers.map((q) => q.map((r) => r - 1).filter((r) => r > 0));
    for (let k = 0; k < 2; k++) {
      const heavy = hash01("h" + s.tick + k) < 0.15;
      const dur = heavy ? 18 : 2 + Math.floor(hash01("d" + s.tick + k) * 4);
      let target = 0;
      if (algo === "rr") { target = s.rr % N; s.rr++; }
      else if (algo === "random") target = Math.floor(hash01("r" + s.tick + k) * N);
      else if (algo === "least") target = s.servers.reduce((b, q, i, a) => (q.length < a[b].length ? i : b), 0);
      else target = Math.floor(hash01("user" + Math.floor(hash01("u" + s.tick + k) * 6)) * N);
      s.servers[target].push(dur);
      s.served[target]++;
    }
    force((x) => x + 1);
  }, 350, running);
  const maxServed = Math.max(1, ...st.current.served);
  const algos: [Algo, string][] = [["rr", "Round robin"], ["random", "Random"], ["least", "Least connections"], ["hash", "Hash(user id)"]];
  return (
    <Viz title="Load balancing algorithms" hint="15% of requests are heavy (long-running). Watch which algorithm handles them best.">
      <div className="vrow">
        {algos.map(([k, l]) => <Btn key={k} on={algo === k} onClick={() => { setAlgo(k); reset(); }}>{l}</Btn>)}
        <span className="vsp" />
        <Btn onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Resume"}</Btn>
        <Btn onClick={reset}>Reset</Btn>
      </div>
      <div className="lb">
        {st.current.servers.map((q, i) => (
          <div key={i} className="lb-srv">
            <div className="lb-name">Server {i + 1}</div>
            <div className="lb-conns">
              {q.map((r, j) => <i key={j} className={r > 10 ? "heavy" : ""} style={{ opacity: 0.45 + Math.min(0.55, r / 20) }} />)}
            </div>
            <div className="lb-count"><span style={{ width: `${(st.current.served[i] / maxServed) * 100}%` }} /></div>
            <small>{q.length} active · {st.current.served[i]} served</small>
          </div>
        ))}
      </div>
      <p className="vnote">
        {algo === "rr" && "Round robin ignores request cost: heavy requests pile up on whichever server happens to receive them."}
        {algo === "random" && "Random is cheap and stateless but uneven in the short term."}
        {algo === "least" && "Least connections adapts to slow requests and keeps active load balanced. Best default for variable-cost work like LLM calls."}
        {algo === "hash" && "Hashing gives affinity (cache or session locality) but can create hot servers when a few keys dominate."}
      </p>
    </Viz>
  );
}

/* ---------- Cache ---------- */
export function CacheSim() {
  const [hit, setHit] = useState(90);
  const [rps, setRps] = useState(5000);
  const [single, setSingle] = useState(false);
  const [burst, setBurst] = useState<number | null>(null);
  const dbLoad = (rps * (100 - hit)) / 100;
  const avg = (hit / 100) * 1 + ((100 - hit) / 100) * 21;
  const expire = () => { setBurst(single ? 1 : 300); setTimeout(() => setBurst(null), 2600); };
  return (
    <Viz title="Cache hit rate and the stampede" hint="Cache 1 ms, database 20 ms. Small hit-rate changes cause big database changes.">
      <div className="vgrid2">
        <Slider label="Cache hit rate" value={hit} min={0} max={99} onChange={setHit} show={(v) => v + "%"} />
        <Slider label="Incoming requests/s" value={rps} min={100} max={50000} step={100} onChange={setRps} show={fmt} />
      </div>
      <div className="vstats">
        <Stat label="requests/s reaching the DB" value={fmt(dbLoad)} tone={dbLoad > 5000 ? "bad" : dbLoad > 1500 ? "warn" : "good"} />
        <Stat label="average latency" value={avg.toFixed(1) + " ms"} />
        <Stat label="DB load vs 0% hit" value={(100 - hit) + "%"} />
      </div>
      <div className="cache-bars">
        <div><span>Hit {hit}%</span><i style={{ width: `${hit}%` }} className="g" /></div>
        <div><span>Miss {100 - hit}%</span><i style={{ width: `${100 - hit}%` }} className="r" /></div>
      </div>
      <div className="vsep" />
      <div className="vrow">
        <b className="vlabel">Stampede:</b>
        <Btn kind="danger" onClick={expire}>A hot key expires under load</Btn>
        <Btn on={single} onClick={() => setSingle((s) => !s)}>Single-flight protection: {single ? "ON" : "OFF"}</Btn>
      </div>
      <div className="stampede">
        {burst === null ? <p className="vnote">Press the button: 300 concurrent requests all miss in the same instant.</p> : (
          <div className="burst">
            {Array.from({ length: Math.min(burst, 60) }).map((_, i) => <i key={i} style={{ animationDelay: `${(i % 20) * 30}ms` }} />)}
            <b>{burst} identical queries hit the database{single ? " (one request fetches, the rest wait for it)" : ""}</b>
          </div>
        )}
      </div>
    </Viz>
  );
}

/* ---------- Gateway flow ---------- */
export function GatewayFlow() {
  const [primaryDown, setPrimaryDown] = useState(false);
  const [cacheHit, setCacheHit] = useState(false);
  const [overQuota, setOverQuota] = useState(false);
  const nodes: FlowNode[] = [
    { id: "client", label: "Client app", icon: "📱" },
    { id: "auth", label: "Auth", sub: "API key / JWT", icon: "🔑" },
    { id: "rl", label: "Rate limit", sub: "tokens + concurrency", icon: "🚦" },
    { id: "cache", label: "Cache", sub: "exact / prefix", icon: "⚡" },
    { id: "router", label: "Router", sub: "model + fallback", icon: "🧭" },
    { id: "pa", label: "Provider A", sub: "primary", icon: "☁️" },
    { id: "pb", label: "Provider B", sub: "fallback", icon: "☁️" },
  ];
  const steps: FlowStep[] = useMemo(() => {
    const s: FlowStep[] = [
      { at: "client", note: "POST /v1/chat (stream=true)", ms: 0 },
      { at: "auth", note: "Validate key, resolve tenant, load budget + policy", ms: 3 },
    ];
    if (overQuota) {
      s.push({ at: "rl", note: "Token bucket empty or budget exhausted: respond 429 with Retry-After, never call a provider", ms: 1, tone: "bad" });
      s.push({ at: "client", note: "Client backs off with jitter", ms: 0, tone: "bad" });
      return s;
    }
    s.push({ at: "rl", note: "Within limits. Reserve estimated tokens, take a concurrency slot", ms: 1 });
    if (cacheHit) {
      s.push({ at: "cache", note: "Exact-match cache hit (same tenant, prompt hash)", ms: 2, tone: "good" });
      s.push({ at: "client", note: "Return cached answer. $0 cost, ~10 ms.", ms: 5, tone: "good" });
      return s;
    }
    s.push({ at: "cache", note: "Miss", ms: 2, tone: "warn" });
    s.push({ at: "router", note: "Pick model by task tier, cost and current provider health", ms: 2 });
    if (primaryDown) {
      s.push({ at: "pa", note: "Provider A returns 529/timeouts. Circuit breaker opens for this upstream", ms: 800, tone: "bad" });
      s.push({ at: "pb", note: "Fail over to Provider B with an equivalent prompt format. Streaming begins", ms: 450, tone: "good" });
    } else {
      s.push({ at: "pa", note: "Streaming tokens back, first token ~400 ms", ms: 400, tone: "good" });
    }
    s.push({ at: "rl", note: "Reconcile real token usage with the reserved estimate; write cost to the ledger", ms: 2 });
    s.push({ at: "client", note: "Stream completes. Trace with tokens, cost, latency, model recorded", ms: 5, tone: "good" });
    return s;
  }, [primaryDown, cacheHit, overQuota]);
  return (
    <Viz title="LLM gateway: one request, many decisions" hint="Flip failure modes and replay.">
      <div className="vrow">
        <Btn on={overQuota} onClick={() => setOverQuota((v) => !v)}>Tenant over quota</Btn>
        <Btn on={cacheHit} onClick={() => setCacheHit((v) => !v)}>Cache hit</Btn>
        <Btn on={primaryDown} onClick={() => setPrimaryDown((v) => !v)}>Provider A down</Btn>
      </div>
      <Flow nodes={nodes} steps={steps} speed={1000} />
    </Viz>
  );
}
