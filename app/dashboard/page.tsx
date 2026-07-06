import { DashboardShell } from "@/components/DashboardShell";
import { TodayDashboard } from "@/components/TodayDashboard";

export default function DashboardPage() {
  return (
    <DashboardShell>
      <TodayDashboard />
    </DashboardShell>
  );
}
