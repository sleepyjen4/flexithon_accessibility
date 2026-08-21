import Image from "next/image";
import Link from "next/link";

/** Marketing navbar for the landing page (/). Swapped in for
 * DashboardNav by SiteNav, since a visitor here hasn't onboarded yet and the
 * Today/Progress/Settings tabs don't apply. */
export function WelcomeNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo-trans.png"
            alt=""
            width={64}
            height={64}
            className="h-12 w-12"
            priority
          />
          <span className="font-display text-lg font-black uppercase tracking-[0.22em] text-ink">
            Alfa
          </span>
        </Link>
        <nav aria-label="Get started" className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/library"
            className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-ink px-4 text-base font-bold text-ink transition-colors hover:bg-mint sm:px-5"
          >
            Library
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-raspberry px-4 text-base font-bold text-milk transition-colors hover:bg-raspberry-deep sm:px-5"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
