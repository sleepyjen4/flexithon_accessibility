import { SettingsForm } from "@/components/SettingsForm";
import { DashboardShell } from "@/components/DashboardShell";

export default function SettingsPage() {
  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-black leading-tight text-ink">
            Settings
          </h1>
          <p className="text-base text-ink-soft">
            Adjust things to fit how you move and see.
          </p>
        </header>
      <SettingsForm />
      </div>
    </DashboardShell>
  );
}
