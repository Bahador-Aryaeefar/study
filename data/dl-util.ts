export const R = String.raw;
export const f = (s: string) => s.replaceAll("~~~", "```").replaceAll("\\`", "`");

export type C = {
  id: string; phase: string; group: string; title: string; tagline: string; viz: string | null;
  explain: string; tradeoffs: string[]; pitfalls: string[]; interview: string[];
  use?: string[]; avoid?: string[]; qa?: { q: string; a: string }[];
  deep?: { title: string; body: string }[];
  compare?: { title: string; head: string[]; rows: string[][] }[];
};
