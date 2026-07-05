import { ProgressView } from "@/components/ProgressView";

export default function ProgressPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 bg-white px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Your progress</h1>
      <p className="text-slate-600">Showing up is the win.</p>
      <ProgressView />
    </div>
  );
}
