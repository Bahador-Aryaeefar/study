"use client";

import { useState } from "react";
import { Scenario } from "@/lib/scenarios";

export default function Scenarios({ list }: { list: Scenario[] }) {
  const [kind, setKind] = useState<"all" | "incident" | "design">("all");
  const [open, setOpen] = useState<string | null>(list[0]?.id ?? null);
  const shown = list.filter((s) => kind === "all" || s.kind === kind);
  const inc = list.filter((s) => s.kind === "incident").length;
  const des = list.length - inc;
  return (
    <section id="scenarios" className="study-sec">
      <div className="sec-title">
        <h2>Scenario playbooks</h2>
        <p>Interviewers love “something broke, what do you do?” and “we need X, which approach?”. Each playbook gives a repeatable order of thinking you can say out loud, then the follow-ups they usually push on.</p>
      </div>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={kind === "all" ? "on" : ""} onClick={() => setKind("all")}>All ({list.length})</button>
        <button className={kind === "incident" ? "on" : ""} onClick={() => setKind("incident")}>🚨 Incidents ({inc})</button>
        <button className={kind === "design" ? "on" : ""} onClick={() => setKind("design")}>🧭 Design choices ({des})</button>
      </div>
      <div className="scn-list">
        {shown.map((s) => (
          <article key={s.id} className={`scn ${s.kind} ${open === s.id ? "open" : ""}`}>
            <button className="scn-head" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>
              <span className="scn-badge">{s.kind === "incident" ? "🚨 Incident" : "🧭 Design"}</span>
              <b>{s.title}</b>
              <small>{s.situation}</small>
            </button>
            {open === s.id && (
              <div className="scn-body">
                <ol className="scn-steps">
                  {s.steps.map((st, i) => (
                    <li key={st.label}>
                      <span className="scn-dot">{i + 1}</span>
                      <div>
                        <h5>{st.label}</h5>
                        <ul>{st.items.map((it) => <li key={it}>{it}</li>)}</ul>
                      </div>
                    </li>
                  ))}
                </ol>
                {s.followups && s.followups.length > 0 && (
                  <>
                    <h5 className="scn-fu">Likely follow-ups</h5>
                    <div className="qa">
                      {s.followups.map((f) => (
                        <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
