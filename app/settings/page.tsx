import { SettingsForm } from "@/components/SettingsForm";

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 bg-white px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">
        Accessibility settings
      </h1>
      <p className="text-slate-600">
        Changes apply right away and are saved for next time.
      </p>
      <SettingsForm />
    </div>
  );
}
