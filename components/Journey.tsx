"use client";

import { PHASE_META, Phase } from "@/lib/roadmap";

interface Props {
  phases: Phase[];
  fractions: number[]; // 0..1 per phase
  onSelect: (id: string) => void;
}

const W = 1000;
const H = 290;

function points(n: number) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x = 60 + (i * (W - 120)) / (n - 1);
    const y = H / 2 + Math.sin(i * 0.95 + 0.4) * 62;
    pts.push({ x, y });
  }
  return pts;
}

// Catmull-Rom to cubic bezier
function pathFrom(pts: { x: number; y: number }[]) {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function Journey({ phases, fractions, onSelect }: Props) {
  const n = phases.length;
  const pts = points(n);
  const d = pathFrom(pts);
  // progress along the road
  let cur = fractions.findIndex((f) => f < 1);
  if (cur === -1) cur = n - 1;
  const t = cur >= n - 1 && fractions[n - 1] >= 1 ? 1 : (cur + fractions[cur]) / (n - 1);
  const R = 24;
  const C = 2 * Math.PI * R;

  return (
    <div className="journey" aria-label="Journey map">
      <div className="journey-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Roadmap journey with 13 stations">
          <defs>
            <linearGradient id="road" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
          </defs>
          <path d={d} fill="none" stroke="var(--c-bd)" strokeWidth="16" strokeLinecap="round" />
          <path d={d} fill="none" stroke="var(--c-w)" strokeWidth="2" strokeDasharray="2 12" strokeLinecap="round" opacity="0.9" />
          <path d={d} pathLength={1} fill="none" stroke="url(#road)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${t} 1`} style={{ transition: "stroke-dasharray .6s ease" }} />
          {phases.map((p, i) => {
            const { x, y } = pts[i];
            const f = fractions[i];
            const done = f >= 1;
            const isCur = i === cur && !done;
            const up = i % 2 === 0;
            return (
              <g key={p.id} className="station" onClick={() => onSelect(p.id)} tabIndex={0} role="link" aria-label={`${p.title}: ${Math.round(f * 100)}%`} onKeyDown={(e) => e.key === "Enter" && onSelect(p.id)}>
                {isCur && <circle cx={x} cy={y} r={R + 8} className="pulse" />}
                <circle cx={x} cy={y} r={R + 4} fill="var(--c-w)" />
                <circle cx={x} cy={y} r={R} fill={done ? "#f97316" : "var(--bg)"} stroke="var(--c-bd)" strokeWidth="5" />
                <circle cx={x} cy={y} r={R} fill="none" stroke="#f97316" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C - C * f} transform={`rotate(-90 ${x} ${y})`} style={{ transition: "stroke-dashoffset .5s ease" }} />
                <text x={x} y={y + 7} textAnchor="middle" fontSize="20" fill={done ? "#fff" : undefined} fontWeight={done ? 800 : undefined}>{done ? "✓" : PHASE_META[p.id]?.icon}</text>
                <text x={x} y={up ? y - R - 14 : y + R + 26} textAnchor="middle" className="st-label">{PHASE_META[p.id]?.short}</text>
                <text x={x} y={up ? y - R - 30 : y + R + 42} textAnchor="middle" className="st-pct">{Math.round(f * 100)}%</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
