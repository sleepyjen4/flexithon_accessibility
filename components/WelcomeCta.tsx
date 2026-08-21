"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useHasAbilityProfile } from "@/store/profile";

/**
 * The landing page's primary call to action, pointed at wherever the visitor
 * actually needs to go.
 *
 * Every route off / used to lead to /onboarding, so a returning user had no
 * way back to their dashboard short of typing the URL — and the flow they were
 * pushed into starts from empty selections and overwrites the profile they
 * already had. Once a profile exists, /dashboard is the right destination, and
 * it carries its own "Adjust your profile" link for anyone who did mean to
 * change it.
 *
 * Copy stays with the page; only the destination and the styling live here.
 */
export function WelcomeCta({
  tone,
  startLabel,
  continueLabel,
}: {
  tone: "hero" | "band";
  startLabel: string;
  continueLabel: string;
}) {
  const hasProfile = useHasAbilityProfile();

  const toneClass =
    tone === "hero"
      ? "bg-raspberry text-milk hover:bg-raspberry-deep"
      : "bg-milk text-ink hover:bg-cream";

  return (
    <Link
      href={hasProfile ? "/dashboard" : "/onboarding"}
      className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-8 text-lg font-bold transition-colors ${toneClass}`}
    >
      {hasProfile ? continueLabel : startLabel}
      <ArrowRight aria-hidden="true" className="h-5 w-5" />
    </Link>
  );
}
