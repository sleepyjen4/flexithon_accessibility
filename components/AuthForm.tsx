"use client";

import { useId, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useProfileStore } from "@/store/profile";
import { Button } from "@/components/Button";

type Mode = "login" | "register";

/** Copy + routing for each mode, kept in one place so the two pages stay in
 * lockstep. Login lands on the dashboard; register hands off to onboarding to
 * build the ability profile (the real start of the core loop). */
const COPY = {
  login: {
    eyebrow: "Welcome back",
    heading: "Log in to keep moving.",
    sub: "Your profile and progress are right where you left them.",
    submit: "Log in",
    pending: "Logging you in…",
    redirect: "/",
    altPrompt: "New here?",
    altLabel: "Create an account",
    altHref: "/register",
  },
  register: {
    eyebrow: "Get started",
    heading: "Create your account.",
    sub: "One quick sign-up, then we'll build your ability profile together.",
    submit: "Create account",
    pending: "Creating your account…",
    redirect: "/onboarding",
    altPrompt: "Already with us?",
    altLabel: "Log in instead",
    altHref: "/login",
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const setDisplayName = useProfileStore((state) => state.setDisplayName);
  const copy = COPY[mode];
  const fieldId = useId();
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);

  // Which fields must be filled before submit unlocks (register also needs a name).
  const requiredFields =
    mode === "register" ? ["name", "email", "password"] : ["email", "password"];

  // Re-check on every keystroke so the button enables only once nothing is blank.
  const handleChange = (event: React.FormEvent<HTMLFormElement>) => {
    const data = new FormData(event.currentTarget);
    setComplete(
      requiredFields.every((field) => String(data.get(field) ?? "").trim() !== ""),
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    // Demo auth: no backend call yet — accept the input and move into the flow.
    // Registration captures the name here so onboarding can skip asking again.
    if (mode === "register") {
      const name = String(
        new FormData(event.currentTarget).get("name") ?? "",
      ).trim();
      setDisplayName(name || null);
    }
    setPending(true);
    router.push(copy.redirect);
  };

  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-5 py-12">
      <div className="rise-in flex flex-col items-center gap-4 text-center">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-raspberry">
            {copy.eyebrow}
          </p>
          <h1 className="font-display text-3xl font-extrabold leading-tight text-ink sm:text-4xl">
            {copy.heading}
          </h1>
          <p className="mx-auto max-w-sm text-lg leading-8 text-ink-soft">
            {copy.sub}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        onChange={handleChange}
        className="rise-in rise-in-2 flex flex-col gap-5 rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8"
        noValidate
      >
        {mode === "register" && (
          <Field
            id={`${fieldId}-name`}
            name="name"
            label="Your name"
            type="text"
            autoComplete="name"
            placeholder="What should we call you?"
          />
        )}

        <Field
          id={`${fieldId}-email`}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
        />

        <Field
          id={`${fieldId}-password`}
          name="password"
          label="Password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder="••••••••"
          hint={
            mode === "register" ? "Use at least 8 characters." : undefined
          }
        />

        <p aria-live="polite" className={pending ? "text-base font-medium text-ink" : "sr-only"}>
          {pending ? copy.pending : ""}
        </p>

        <Button type="submit" disabled={pending || !complete} className="mt-1">
          {pending ? copy.pending : copy.submit}
        </Button>
      </form>

      <p className="rise-in rise-in-3 text-center text-base text-ink-soft">
        {copy.altPrompt}{" "}
        <Link
          href={copy.altHref}
          className="font-bold text-raspberry underline underline-offset-4 hover:text-[#8f2a47]"
        >
          {copy.altLabel}
        </Link>
      </p>
    </section>
  );
}

/** Labelled text input matching the warm-paper form style used across the app
 * (see CheckInForm / SettingsForm): visible label, thick interactive border,
 * 18px text, generous tap height. */
function Field({
  id,
  label,
  hint,
  ...inputProps
}: {
  id: string;
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-lg font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        required
        aria-describedby={hintId}
        // Password managers / form-fillers inject attributes (e.g.
        // `fdprocessedid`) before hydration; suppress the resulting mismatch.
        suppressHydrationWarning
        className="min-h-14 rounded-xl border-2 border-line-strong bg-surface px-4 py-3 text-lg text-ink placeholder:text-ink-soft/70 focus-visible:border-ink"
        {...inputProps}
      />
      {hint && (
        <p id={hintId} className="text-base text-ink-soft">
          {hint}
        </p>
      )}
    </div>
  );
}
