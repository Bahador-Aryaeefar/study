import p00 from "@/data/phases/00-foundations.json";
import p01 from "@/data/phases/01-math-ml.json";
import p02 from "@/data/phases/02-deep-learning.json";
import p03 from "@/data/phases/03-llm-engineering.json";
import p04 from "@/data/phases/04-rag.json";
import p05 from "@/data/phases/05-agents.json";
import p06 from "@/data/phases/06-evals-observability.json";
import p07 from "@/data/phases/07-safety-security.json";
import p08 from "@/data/phases/08-backend-data.json";
import p09 from "@/data/phases/09-devops-cloud.json";
import p10 from "@/data/phases/10-mlops.json";
import p11 from "@/data/phases/11-system-design.json";
import p12 from "@/data/phases/12-interview-career.json";
import cpA from "@/data/checkpoints-a.json";
import cpB from "@/data/checkpoints-b.json";
import ddA from "@/data/deep-dives-a.json";
import ddB from "@/data/deep-dives-b.json";
import ddC from "@/data/deep-dives-c.json";

export type Level = "foundation" | "core" | "advanced" | "interview";

export interface Concept {
  title: string;
  body: string;
}
export interface Entry {
  id: string;
  text: string;
}
export interface Topic {
  key: string;
  id: string;
  title: string;
  summary: string;
  items: Entry[];
  questions: Entry[];
  resources: string[];
  concepts: Concept[];
}
export interface Phase {
  id: string;
  index: number;
  title: string;
  tagline: string;
  level: Level;
  color: string;
  topics: Topic[];
  checkpoint: Checkpoint;
}

interface RawTopic {
  id: string;
  title: string;
  summary: string;
  items: string[];
  questions?: string[];
  resources?: string[];
  concepts?: Concept[];
}
interface RawPhase {
  id: string;
  title: string;
  tagline: string;
  level: string;
  color: string;
  topics: RawTopic[];
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

const raw = [p00, p01, p02, p03, p04, p05, p06, p07, p08, p09, p10, p11, p12] as RawPhase[];

export interface Config {
  title: string;
  lang: string;
  note?: string;
  code: string;
}
export interface Checkpoint {
  mustKnow: Entry[];
  mustDo: Entry[];
  configs: Config[];
}
interface RawCheckpoint {
  mustKnow: string[];
  mustDo: string[];
  configs: Config[];
}

const checkpointsRaw = { ...cpA, ...cpB } as Record<string, RawCheckpoint>;
const deepDives = { ...ddA, ...ddB, ...ddC } as Record<string, Concept[]>;

const LEVEL_COLOR: Record<Level, string> = {
  foundation: "#f59e0b",
  core: "#f97316",
  advanced: "#ea580c",
  interview: "#c2410c",
};

export const PHASE_META: Record<string, { icon: string; short: string }> = {
  foundations: { icon: "🧱", short: "Foundations" },
  "math-ml": { icon: "📐", short: "Math & ML" },
  "deep-learning": { icon: "🧠", short: "Deep Learning" },
  "llm-engineering": { icon: "💬", short: "LLM Eng" },
  rag: { icon: "🔎", short: "RAG" },
  agents: { icon: "🤖", short: "Agents" },
  "evals-observability": { icon: "📊", short: "Evals" },
  "safety-security": { icon: "🛡️", short: "Security" },
  "backend-data": { icon: "🗄️", short: "Backend" },
  "devops-cloud": { icon: "☁️", short: "DevOps" },
  mlops: { icon: "⚙️", short: "MLOps" },
  "system-design": { icon: "🏗️", short: "System Design" },
  "interview-career": { icon: "🎯", short: "Interview" },
};

export const phases: Phase[] = raw.map((p, index) => {
  const cp = checkpointsRaw[p.id];
  return {
    id: p.id,
    index,
    title: p.title,
    tagline: p.tagline,
    level: p.level as Level,
    color: LEVEL_COLOR[p.level as Level],
    topics: p.topics.map((t) => {
      const key = `${p.id}.${t.id}`;
      return {
        key,
        id: t.id,
        title: t.title,
        summary: t.summary,
        items: t.items.map((text) => ({ id: `${key}.i.${slug(text)}`, text })),
        questions: (t.questions ?? []).map((text) => ({ id: `${key}.q.${slug(text)}`, text })),
        resources: t.resources ?? [],
        concepts: [...(t.concepts ?? []), ...(deepDives[key] ?? [])],
      };
    }),
    checkpoint: cp
      ? {
          mustKnow: cp.mustKnow.map((text) => ({ id: `${p.id}.cp.k.${slug(text)}`, text })),
          mustDo: cp.mustDo.map((text) => ({ id: `${p.id}.cp.d.${slug(text)}`, text })),
          configs: cp.configs,
        }
      : { mustKnow: [], mustDo: [], configs: [] },
  };
});

export const LEVEL_LABEL: Record<Level, string> = {
  foundation: "Foundation",
  core: "Core",
  advanced: "Advanced",
  interview: "Interview",
};

export interface Progress {
  version: 1;
  done: Record<string, string>;
  notes: Record<string, string>;
  updatedAt?: string;
}

export const emptyProgress = (): Progress => ({ version: 1, done: {}, notes: {} });
