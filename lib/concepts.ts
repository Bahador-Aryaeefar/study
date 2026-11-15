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

export const concepts: ConceptDef[] = [...(sd as ConceptDef[]), ...(nc as ConceptDef[]), ...(nc2 as ConceptDef[]), ...(p1 as ConceptDef[]), ...(p2 as ConceptDef[]), ...(ai as ConceptDef[])].map((c) => ({ ...c, ...(usage[c.id] ?? {}), ...(extra[c.id] ?? {}) }));

export const conceptsFor = (phaseId: string) => concepts.filter((c) => c.phase === phaseId);

export const problems = (bd as { problems: Problem[] }).problems;
export const technologies = (bd as { technologies: Tech[] }).technologies;
