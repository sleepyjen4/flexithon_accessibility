"use client";

import Image from "next/image";
import Link from "next/link";
import { useHasAbilityProfile } from "@/store/profile";

/** Marketing navbar for the landing page (/). Swapped in for
 * DashboardNav by SiteNav, since a first-time visitor has no profile yet and
 * the Today/Progress/Settings tabs don't apply. A visitor who *has* onboarded
 * can still land here (the logo links to /), so the action points at their
 * dashboard rather than sending them back through onboarding. */
export function WelcomeNav() {
  const hasProfile = useHasAbilityProfile();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-10">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Image
            src="/logo-trans.png"
            alt=""
            width={64}
            height={64}
            className="h-12 w-12 shrink-0"
            priority
          />
          {/* The header carries a fixed logo and two pills, and only fits at
              390px under the Compact text size: at the 18px default the
              wordmark collided with the Library pill by 21px, and by 66px at
              X-Large — turning up the text size broke the nav that offers it.
              Below sm the wordmark steps aside, staying `sr-only` rather than
              hidden because the logo is decorative (alt="") and dropping it
              outright would leave this link with no accessible name. */}
          <span className="sr-only font-display text-lg font-black uppercase tracking-[0.22em] text-ink sm:not-sr-only">
            Alfa
          </span>
        </Link>
        <nav
          aria-label={hasProfile ? "Your account" : "Get started"}
          className="flex shrink-0 items-center gap-2 sm:gap-3"
        >
          <Link
            href="/library"
            className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-ink px-4 text-base font-bold text-ink transition-colors hover:bg-mint sm:px-5"
          >
            Library
          </Link>
          <Link
            href={hasProfile ? "/dashboard" : "/onboarding"}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-raspberry px-4 text-base font-bold text-milk transition-colors hover:bg-raspberry-deep sm:px-5"
          >
            {hasProfile ? "Dashboard" : "Get started"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
