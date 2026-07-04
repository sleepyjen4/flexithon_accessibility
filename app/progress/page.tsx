import { Card } from "@/components/Card";

export default function ProgressPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 bg-white px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Your progress</h1>
      <p className="max-w-md text-slate-600">
        Consistency and effort — never calories or steps.
      </p>
      <Card>
        <p className="text-slate-600">
          Consistency calendar + effort log (F6) go here.
        </p>
      </Card>
    </div>
  );
}
