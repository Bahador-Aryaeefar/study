"use client";

import { useState } from "react";
import { Phase } from "@/lib/roadmap";
import { useProgress } from "@/lib/progress";
import { CodeBlock } from "./Rich";

type Tab = "know" | "do" | "cfg";

export default function Checkpoint({ phase }: { phase: Phase }) {
  const { done, toggle } = useProgress();
  const [tab, setTab] = useState<Tab>("know");
  const cp = phase.checkpoint;
  const k = cp.mustKnow.filter((i) => done[i.id]).length;
  const d = cp.mustDo.filter((i) => done[i.id]).length;
  const total = cp.mustKnow.length + cp.mustDo.length;
  const list = (items: typeof cp.mustKnow) => (
    <ul className="checks">
      {items.map((i) => (
        <li key={i.id}>
          <label>
            <input type="checkbox" checked={!!done[i.id]} onChange={() => toggle(i.id)} />
            <span className="box" />
            <span className={done[i.id] ? "txt done" : "txt"}>{i.text}</span>
          </label>
        </li>
      ))}
    </ul>
  );
  return (
    <section id="checkpoint" className="checkpoint">
      <div className="cp-head">
        <span className="flag">🚩</span>
        <div>
          <h3>Phase {phase.index + 1} checkpoint</h3>
          <p>Don&rsquo;t move on until you can tick all of this. {k + d}/{total} done.</p>
        </div>
      </div>
      <div className="tabs cp-tabs" role="tablist">
        <button className={tab === "know" ? "on" : ""} onClick={() => setTab("know")}>Must know <em>{k}/{cp.mustKnow.length}</em></button>
        <button className={tab === "do" ? "on" : ""} onClick={() => setTab("do")}>Must build <em>{d}/{cp.mustDo.length}</em></button>
        <button className={tab === "cfg" ? "on" : ""} onClick={() => setTab("cfg")}>Configs &amp; code <em>{cp.configs.length}</em></button>
      </div>
      {tab === "know" && list(cp.mustKnow)}
      {tab === "do" && list(cp.mustDo)}
      {tab === "cfg" && (
        <div className="cfgs">
          <p className="cfg-hint">Be able to write these from memory (or explain every line). Copy them as a starting point.</p>
          {cp.configs.map((c) => <CodeBlock key={c.title} code={c.code} lang={c.lang} title={c.title} note={c.note} />)}
        </div>
      )}
    </section>
  );
}
