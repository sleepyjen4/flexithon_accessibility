import { Card } from "@/components/Card";

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 bg-white px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">
        Accessibility settings
      </h1>
      <Card>
        <p className="text-slate-600">
          Text size, high contrast, reduced motion, and haptics toggle (F7)
          go here.
        </p>
      </Card>
    </div>
  );
}
