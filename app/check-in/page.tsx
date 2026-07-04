import { Card } from "@/components/Card";

export default function CheckInPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 bg-white px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">
        How&apos;s your energy today?
      </h1>
      <p className="max-w-md text-slate-600">
        One tap, done. There&apos;s no wrong answer.
      </p>
      <Card>
        <p className="text-slate-600">
          Energy picker (F3, 1-5 battery scale) goes here.
        </p>
      </Card>
    </div>
  );
}
