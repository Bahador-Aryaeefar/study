import sd from "@/data/concepts-sd.json";
import ai from "@/data/concepts-ai.json";
import bd from "@/data/breakdowns.json";
import ua from "@/data/usage-a.json";
import ub from "@/data/usage-b.json";
import d1 from "@/data/deep-1.json";
import d2 from "@/data/deep-2.json";
import d3 from "@/data/deep-3.json";
import nc from "@/data/concepts-new.json";
import nc2 from "@/data/concepts-new2.json";
import p1 from "@/data/concepts-p1.json";
import p2 from "@/data/concepts-p2.json";
import mathConcepts from "@/data/concepts-math";
import mathBasics from "@/data/concepts-math-basics";

export interface ConceptDef {
  id: string;
  phase: string;
  group: string;
  title: string;
  tagline: string;
  viz: string | null;
  explain: string;
  tradeoffs: string[];
  pitfalls: string[];
  interview: string[];
  use?: string[];
  avoid?: string[];
  qa?: { q: string; a: string }[];
  deep?: { title: string; body: string }[];
  compare?: { title: string; head: string[]; rows: string[][] }[];
  flows?: { title: string; hint?: string; nodes: { id: string; label: string; sub?: string; icon?: string }[]; steps: { at: string; note: string; ms?: number; tone?: "good" | "bad" | "warn" }[] }[];
}

const extra = { ...d1, ...d2, ...d3 } as Record<string, Partial<ConceptDef>>;

interface Usage { use: string[]; avoid: string[]; qa: { q: string; a: string }[] }
const usage = { ...ua, ...ub } as Record<string, Usage>;

export interface Problem {
  id: string;
  title: string;
  level: string;
  teaches: string;
  requirements: string[];
  design: string[];
  deepDives: string[];
}

export interface Tech {
  id: string;
  title: string;
  kind: string;
  what: string;
  useWhen: string[];
  internals: string[];
  watchOut: string[];
}

const merged: ConceptDef[] = [...(sd as ConceptDef[]), ...(nc as ConceptDef[]), ...(nc2 as ConceptDef[]), ...(p1 as ConceptDef[]), ...(p2 as ConceptDef[]), ...(mathConcepts as ConceptDef[]), ...(mathBasics as ConceptDef[]), ...(ai as ConceptDef[])].map((c) => ({ ...c, ...(usage[c.id] ?? {}), ...(extra[c.id] ?? {}) }));

// Phase 01 is taught basics -> advanced: fixed order and numbered groups.
const G_EVAL = "3 · Evaluation (do this before trusting numbers)";
const G_DEEP = "5 · Math deepening";
const G_MODERN = "6 · Modern ML";
const G_RESEARCH = "7 · Research craft";
const MATH_PATH: [string, string?][] = [
  ["m-path"], ["m-vectors"], ["m-derivative"], ["m-prob-basics"],
  ["m-linreg"], ["m-logreg"], ["m-trees"], ["m-knn-svm-nb"], ["m-clustering"],
  ["m-cv-protocol"], ["ml-metrics", G_EVAL], ["m-nn-basics"],
  ["m-linalg-svd", G_DEEP], ["m-calc-backprop", G_DEEP], ["m-optimization", G_DEEP], ["m-prob-bayes", G_DEEP], ["m-info-theory", G_DEEP], ["m-softmax-ce", G_DEEP], ["m-generalization", G_DEEP],
  ["m-modern-dl", G_MODERN], ["m-generative", G_MODERN], ["m-rl-bayes", G_MODERN],
  ["m-stats-research", G_RESEARCH], ["m-reading-writing", G_RESEARCH],
];
const rank = new Map(MATH_PATH.map(([id], i) => [id, i]));
const regroup = new Map(MATH_PATH.filter(([, g]) => g).map(([id, g]) => [id, g as string]));
const isMath = (x: ConceptDef) => x.phase === "math-ml";
const mathSorted = merged
  .filter(isMath)
  .map((x) => ({ ...x, group: regroup.get(x.id) ?? x.group }))
  .sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
let mi = 0;
export const concepts: ConceptDef[] = merged.map((x) => (isMath(x) ? mathSorted[mi++] : x));

export const conceptsFor = (phaseId: string) => concepts.filter((c) => c.phase === phaseId);

export const problems = (bd as { problems: Problem[] }).problems;
export const technologies = (bd as { technologies: Tech[] }).technologies;
