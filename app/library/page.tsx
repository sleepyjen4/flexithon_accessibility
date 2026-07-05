import { ExerciseLibraryDashboard } from "@/components/ExerciseLibraryDashboard";

export default function LibraryPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 bg-white px-6 py-10">
      <h1 className="text-3xl font-bold text-slate-900">Library</h1>
      <ExerciseLibraryDashboard />
    </div>
  );
}
