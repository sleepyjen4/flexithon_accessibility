import { DashboardShell } from "@/components/DashboardShell";
import { TodayDashboard } from "@/components/TodayDashboard";

export default function Home() {
  return (
    <DashboardShell>
      <TodayDashboard />
    </DashboardShell>
  );
}
