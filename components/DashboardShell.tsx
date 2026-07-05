/** Centered content container for the dashboard-style pages. The primary nav
 * and the fixed-nav bottom clearance live in the root layout now, so this is
 * just the max-width column with page padding. */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-8 sm:px-8 lg:px-10 lg:pt-10">
      {children}
    </div>
  );
}
