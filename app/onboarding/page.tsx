import { Card } from "@/components/Card";

export default function OnboardingPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 bg-white px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">
        Build your ability profile
      </h1>
      <p className="max-w-md text-slate-600">
        A few quick questions about positions, equipment, and limits — never
        diagnoses. Skip anything you&apos;d rather not answer.
      </p>
      <Card>
        <p className="text-slate-600">
          Onboarding steps (F1) go here — 4-6 screens max.
        </p>
      </Card>
    </div>
  );
}
