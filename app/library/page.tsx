import { DashboardShell } from "@/components/DashboardShell";
import { ExerciseLibraryDashboard } from "@/components/ExerciseLibraryDashboard";

export default function LibraryPage() {
  return (
    <DashboardShell>
      <div className="flex flex-col gap-8">
        <header className="rise-in space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-raspberry">
            Exercise library
          </p>
          <h1 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">
            Browse by what works for you
          </h1>
          <p className="max-w-2xl text-lg text-ink-soft">
            30+ exercises, each with a seated or lying variant. Filter by
            position, equipment, body region, or category to find what fits
            today.
          </p>
        </header>
        <ExerciseLibraryDashboard />
      </div>
    </DashboardShell>
  );
}
