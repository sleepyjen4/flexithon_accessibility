"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Play, SlidersHorizontal } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Today", icon: Play },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: SlidersHorizontal },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-slate-50 text-slate-950">
      <DashboardNav />
      <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-8 sm:px-8 lg:px-10 lg:pb-12 lg:pt-10">
        {children}
      </div>
    </div>
  );
}

function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 py-1 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] lg:static lg:border-b lg:border-t-0 lg:px-10 lg:py-4 lg:shadow-sm"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Link
          href="/"
          className="hidden text-sm font-black uppercase tracking-[0.28em] text-[#41637f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 lg:inline-flex"
        >
          Adaptive Fitness
        </Link>
      <ul className="grid list-none grid-cols-3 p-0 lg:flex lg:gap-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 flex-col items-center justify-center rounded-md px-2 text-[0.68rem] font-bold leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 lg:min-h-12 lg:flex-row lg:gap-1 lg:rounded-xl lg:px-4 lg:text-sm ${
                  active
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Icon
                  aria-hidden="true"
                  className={`mb-0.5 h-[1.125rem] w-[1.125rem] lg:mb-0 lg:h-6 lg:w-6 ${active ? "text-[#41637f]" : "text-slate-400"}`}
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