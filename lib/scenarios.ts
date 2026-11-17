import s1 from "@/data/scenarios-1.json";
import s2 from "@/data/scenarios-2.json";
import s3 from "@/data/scenarios-3.json";
import sm from "@/data/scenarios-math.json";
import sdl from "@/data/scenarios-dl.json";

export interface Scenario {
  id: string;
  phase: string;
  kind: "incident" | "design";
  title: string;
  situation: string;
  steps: { label: string; items: string[] }[];
  followups?: { q: string; a: string }[];
}

export const scenarios = [...(s1 as Scenario[]), ...(s2 as Scenario[]), ...(s3 as Scenario[]), ...(sm as Scenario[]), ...(sdl as Scenario[])];
export const scenariosFor = (phaseId: string) => scenarios.filter((s) => s.phase === phaseId);
