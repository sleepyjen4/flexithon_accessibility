"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Play, SlidersHorizontal } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Today", icon: Play },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: SlidersHorizontal },
];

/** App-wide primary navigation. Rendered once in the root layout so it stays
 * visible on every page: a fixed bottom bar on mobile, a sticky top bar on
 * desktop (so it never scrolls out of reach). */
export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-3 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-8px_24px_rgba(33,29,25,0.08)] lg:sticky lg:top-0 lg:bottom-auto lg:border-b lg:border-t-0 lg:px-10 lg:py-4 lg:pb-4 lg:shadow-none"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Link
          href="/"
          className="hidden items-center gap-2 text-sm font-black uppercase tracking-[0.28em] text-ink lg:inline-flex"
        >
          <Image
            src="/logo-trans.png"
            alt=""
            width={64}
            height={64}
            className="h-12 w-12"
          />
          Alfa
        </Link>
        <ul className="grid list-none grid-cols-3 p-0 lg:flex lg:gap-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-xs font-bold leading-tight transition-colors lg:min-h-12 lg:flex-row lg:gap-2 lg:rounded-full lg:px-5 lg:text-base ${
                    active
                      ? "bg-mint text-ink"
                      : "text-ink-soft hover:bg-cream hover:text-ink"
                  }`}
                >
                  <Icon
                    aria-hidden="true"
                    className={`h-5 w-5 lg:h-5 lg:w-5 ${active ? "text-evergreen" : ""}`}
                    strokeWidth={active ? 3 : 2.5}
                  />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
