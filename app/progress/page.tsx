import { ProgressView } from "@/components/ProgressView";
import { DashboardShell } from "@/components/DashboardShell";

export default function ProgressPage() {
  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-black leading-tight text-slate-950">
            Your progress
          </h1>
          <p className="text-base text-slate-500">Showing up is the win.</p>
        </header>
      <ProgressView />
      </div>
    </DashboardShell>
  );
}
