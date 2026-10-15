import { DampakProgramView } from "@/components/DampakProgramView";

export default async function DampakProgramPage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  const { program } = await searchParams;
  return <DampakProgramView initialProgram={program} />;
}
