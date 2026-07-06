"use client";

import { usePathname } from "next/navigation";
import { CHROME_HIDDEN_ROUTES } from "@/lib/chromeRoutes";
import { DashboardNav } from "@/components/DashboardNav";
import { WelcomeNav } from "@/components/WelcomeNav";

/** Swaps the app's DashboardNav for the marketing WelcomeNav on chrome-hidden
 * routes (e.g. the landing page at /), so each renders as its own top-level banner
 * landmark rather than nesting a second header inside <main>. */
export function SiteNav() {
  const pathname = usePathname();
  return CHROME_HIDDEN_ROUTES.includes(pathname) ? (
    <WelcomeNav />
  ) : (
    <DashboardNav />
  );
}
