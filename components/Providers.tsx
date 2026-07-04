"use client";

/**
 * Single wrapper for future client-side providers (e.g. Supabase auth
 * listener, toast root). Keeps app/layout.tsx a Server Component.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
