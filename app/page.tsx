import Image from "next/image";
import Link from "next/link";
import { WelcomeCta } from "@/components/WelcomeCta";

export default function WelcomePage() {
  return (
    <div className="flex flex-1 flex-col bg-cream">
      {/* Hero */}
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-5 py-14 text-center lg:py-20">
        <Image
          src="/logo-trans.png"
          alt=""
          width={96}
          height={96}
          className="rise-in h-20 w-20 lg:h-24 lg:w-24"
          priority
        />
        <div className="rise-in rise-in-2 space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-raspberry">
            Adaptive fitness
          </p>
          <h1 className="font-display text-4xl font-extrabold leading-tight text-ink sm:text-5xl lg:text-6xl">
            Fitness that meets your body where it is.
          </h1>
          <p className="mx-auto max-w-xl text-lg leading-8 text-ink-soft">
            Alfa builds today&apos;s workout around your positions, your
            equipment, and your energy, not a generic standard you&apos;re
            expected to hit.
          </p>
          <p className="mx-auto max-w-xl text-base leading-7 text-ink-soft">
            No account needed. Your profile, calibration, and history stay on
            this device, and the camera never leaves it.
          </p>
        </div>

        <div className="rise-in rise-in-3 flex flex-col gap-3 sm:flex-row">
          <WelcomeCta
            tone="hero"
            startLabel="Get started"
            continueLabel="Continue to your dashboard"
          />
          <Link
            href="/library"
            className="inline-flex min-h-14 items-center justify-center rounded-full border-2 border-ink px-8 text-lg font-bold text-ink transition-colors hover:bg-mint"
          >
            Browse the exercise library
          </Link>
        </div>

        <blockquote className="rise-in rise-in-4 mt-4 max-w-lg rounded-3xl border border-line bg-surface px-8 py-6 shadow-card">
          <p className="font-display text-xl font-bold leading-snug text-ink sm:text-2xl">
            “Some days call for strength. Others call for stillness. Both
            count.”
          </p>
          <footer className="mt-3 text-sm font-bold uppercase tracking-[0.18em] text-ink-soft">
            Alfa
          </footer>
        </blockquote>
      </section>

      {/* Bottom CTA band */}
      <section className="on-dark bg-stage px-5 py-14 text-center lg:py-20">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5">
          <h2 className="font-display text-3xl font-extrabold text-milk sm:text-4xl">
            Show up today, exactly as you are.
          </h2>
          <p className="text-lg leading-8 text-milk-soft">
            Set up your ability profile once, then check in whenever you move.
            Good day or hard day, no penalty either way.
          </p>
          <WelcomeCta
            tone="band"
            startLabel="Create your profile"
            continueLabel="Go to your dashboard"
          />
        </div>
      </section>
    </div>
  );
}
