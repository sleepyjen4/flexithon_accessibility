"use client";

import { useEffect } from "react";
import { useProfileStore } from "@/store/profile";
import { applyPrefsToDocument } from "@/lib/prefs";

/**
 * Client wrapper that keeps app/layout.tsx a Server Component and applies
 * persisted accessibility prefs (F7) to the document root on load and on
 * every change.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const prefs = useProfileStore((state) => state.prefs);

  useEffect(() => {
    applyPrefsToDocument(prefs);
  }, [prefs]);

  return <>{children}</>;
}
