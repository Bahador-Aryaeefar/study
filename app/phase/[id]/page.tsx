import { notFound } from "next/navigation";
import PhaseStudy from "@/components/PhaseStudy";
import { phases } from "@/lib/roadmap";

export function generateStaticParams() {
  return phases.map((p) => ({ id: p.id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!phases.some((p) => p.id === id)) notFound();
  return <PhaseStudy phaseId={id} />;
}
