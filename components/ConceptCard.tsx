"use client";

import { useEffect, useRef, useState } from "react";
import { ConceptDef } from "@/lib/concepts";
import { useProgress } from "@/lib/progress";
import { Rich } from "./Rich";
import { VizByKey } from "./viz";
import { Flow, Viz } from "./viz/ui";

/** Mounts children only while near the viewport so animations do not all run at once. */
function InView({ children, minHeight = 360 }: { children: React.ReactNode; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setOn(true); return; }
    const io = new IntersectionObserver((e) => setOn(e[0].isIntersecting), { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} style={{ minHeight: on ? undefined : minHeight }}>{on ? children : <div className="viz-ph">Loading interactive…</div>}</div>;
}

export default function ConceptCard({ c }: { c: ConceptDef }) {
  const { done, toggle } = useProgress();
  const key = `concept.${c.id}`;
  return (
    <article id={`c-${c.id}`} className="concept-card">
      <header>
        <div>
          <span className="cgroup">{c.group}</span>
          <h3>{c.title}</h3>
          <p className="ctag">{c.tagline}</p>
        </div>
        <label className={`understood ${done[key] ? "on" : ""}`}>
          <input type="checkbox" checked={!!done[key]} onChange={() => toggle(key)} />
          <span className="box" />
          <span>{done[key] ? "Understood" : "Mark understood"}</span>
        </label>
      </header>
      {c.viz && <InView><VizByKey k={c.viz} /></InView>}
      <div className="cbody">
        <h4>How it works</h4>
        <Rich body={c.explain} />
        {c.flows?.map((f) => (
          <Viz key={f.title} title={f.title} hint={f.hint}><Flow nodes={f.nodes} steps={f.steps} speed={1100} /></Viz>
        ))}
        {c.deep?.map((d, i) => (
          <details key={d.title} className="deep" open={i === 0}>
            <summary>{d.title}</summary>
            <Rich body={d.body} />
          </details>
        ))}
        {c.compare?.map((t) => (
          <div key={t.title} className="cmp">
            <h4>{t.title}</h4>
            <div className="cmp-scroll">
              <table>
                <thead><tr>{t.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{t.rows.map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        ))}
        {!!(c.use?.length || c.avoid?.length) && (
          <div className="cols ua">
            <div className="use">
              <h4>Use it when</h4>
              <ul>{(c.use ?? []).map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <div className="avoid">
              <h4>Avoid it when</h4>
              <ul className="warn">{(c.avoid ?? []).map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          </div>
        )}
        <div className="cols">
          <div>
            <h4>Trade-offs</h4>
            <ul>{c.tradeoffs.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div>
            <h4>Common pitfalls</h4>
            <ul className="warn">{c.pitfalls.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
        <h4>Interview angles</h4>
        <ul className="iq">{c.interview.map((t) => <li key={t}>{t}</li>)}</ul>
        {c.qa && c.qa.length > 0 && (
          <>
            <h4>Interviewer follow-ups, with model answers</h4>
            <div className="qa">
              {c.qa.map((x) => (
                <details key={x.q}>
                  <summary>{x.q}</summary>
                  <p>{x.a}</p>
                </details>
              ))}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
