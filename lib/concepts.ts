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
import dl1 from "@/data/concepts-dl-1";
import dl2 from "@/data/concepts-dl-2";
import dl3 from "@/data/concepts-dl-3";

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

const merged: ConceptDef[] = [...(sd as ConceptDef[]), ...(nc as ConceptDef[]), ...(nc2 as ConceptDef[]), ...(p1 as ConceptDef[]), ...(p2 as ConceptDef[]), ...(mathConcepts as ConceptDef[]), ...(mathBasics as ConceptDef[]), ...(dl1 as ConceptDef[]), ...(dl2 as ConceptDef[]), ...(dl3 as ConceptDef[]), ...(ai as ConceptDef[])].map((c) => ({ ...c, ...(usage[c.id] ?? {}), ...(extra[c.id] ?? {}) }));

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
const DL_TRANSFORMER = "4 · The Transformer";
const DL_TOKENS = "5 · Tokens, embeddings and self-supervised learning";
const DL_PATH: [string, string?][] = [
  ["dl-path"],
  ["dl-activations"], ["dl-losses"], ["dl-normalization"], ["dl-regularization"], ["dl-optim-recipes"], ["dl-pytorch-debug"],
  ["dl-cnn"], ["dl-vision-modern"],
  ["dl-rnn"], ["dl-attention"],
  ["dl-transformer-block"], ["attention-transformer", DL_TRANSFORMER], ["dl-efficient-attention"], ["dl-moe-ssm"],
  ["dl-tokenization"], ["tokenization", DL_TOKENS], ["dl-embeddings"], ["dl-selfsup"], ["dl-gnn"],
  ["dl-pretraining"], ["dl-scaling"], ["dl-distributed"],
  ["dl-sft-peft"], ["dl-alignment"], ["dl-compression"],
  ["dl-interp-robust"], ["dl-experiments"], ["dl-paper-writing"],
];
const PATHS: Record<string, [string, string?][]> = { "math-ml": MATH_PATH, "deep-learning": DL_PATH };

function ordered(all: ConceptDef[]): ConceptDef[] {
  const out = all.slice();
  for (const [phase, path] of Object.entries(PATHS)) {
    const rank = new Map(path.map(([id], i) => [id, i]));
    const regroup = new Map(path.filter(([, g]) => g).map(([id, g]) => [id, g as string]));
    const idx: number[] = [];
    all.forEach((x, i) => { if (x.phase === phase) idx.push(i); });
    const sorted = idx
      .map((i) => all[i])
      .map((x) => ({ ...x, group: regroup.get(x.id) ?? x.group }))
      .sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
    idx.forEach((slot, k) => { out[slot] = sorted[k]; });
  }
  return out;
}
export const concepts: ConceptDef[] = ordered(merged);

export const conceptsFor = (phaseId: string) => concepts.filter((c) => c.phase === phaseId);

export const problems = (bd as { problems: Problem[] }).problems;
export const technologies = (bd as { technologies: Tech[] }).technologies;
