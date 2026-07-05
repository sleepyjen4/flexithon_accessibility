"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CHROME_HIDDEN_ROUTES } from "@/lib/chromeRoutes";

/** The bottom padding below normally clears DashboardNav's fixed mobile bar;
 * chrome-hidden routes (e.g. /welcome) render no such bar, so they skip it. */
export function AppMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const chromeHidden = CHROME_HIDDEN_ROUTES.includes(pathname);

  return (
    <main
      id="main-content"
      className={
        chromeHidden
          ? "flex flex-1 flex-col"
          : "flex flex-1 flex-col pb-[calc(env(safe-area-inset-bottom)+8rem)] lg:pb-12"
      }
    >
      {children}
    </main>
  );
}
