"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Abilities, EnergyLevel } from "@/types";
import { generateWorkout } from "@/lib/ai";
import { useProfileStore } from "@/store/profile";
import { useSessionStore } from "@/store/session";
import { useHistoryStore } from "@/store/history";
import { EnergyPicker } from "@/components/EnergyPicker";
import { Button } from "@/components/Button";

/** Inclusive default when someone lands here without onboarding —
 * seated/lying, no equipment assumptions beyond a chair and a wall. */
const DEFAULT_ABILITIES: Abilities = {
  positions: ["seated", "lying"],
  equipment: ["none", "chair", "wall"],
  avoid_regions: [],
  sensory: { captions: true, reduced_motion: false, haptics: false },
};

export function CheckInForm() {
  const router = useRouter();
  const abilities = useProfileStore((state) => state.abilities);
  const setTodaysEnergy = useProfileStore((state) => state.setTodaysEnergy);
  const setWorkout = useSessionStore((state) => state.setWorkout);
  const addCheckin = useHistoryStore((state) => state.addCheckin);
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const submit = async () => {
    if (!energy) return;
    setStatus("loading");
    setTodaysEnergy(energy);
    addCheckin({ energy, date: new Date().toISOString().slice(0, 10) });
    try {
      const workout = await generateWorkout({
        abilities: abilities ?? DEFAULT_ABILITIES,
        energy,
        recentSessionIds: [],
      });
      setWorkout(workout);
      router.push("/exercise");
    } catch {
      // generateWorkout falls back internally; this is a safety net.
      setStatus("error");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">
        How&apos;s your energy today?
      </h1>
      <p className="text-slate-600">
        There&apos;s no wrong answer — today&apos;s plan will match today&apos;s you.
      </p>
      {!abilities && (
        <p className="rounded-2xl bg-slate-50 p-4 text-slate-600">
          You haven&apos;t set up an ability profile yet, so we&apos;ll suggest
          seated and lying exercises with no equipment.{" "}
          <Link href="/onboarding" className="font-semibold text-indigo-700 underline underline-offset-4">
            Set up your profile
          </Link>{" "}
          whenever you like.
        </p>
      )}

      <EnergyPicker value={energy} onChange={setEnergy} />

      <div className="flex flex-col gap-2">
        <label htmlFor="checkin-note" className="text-lg font-semibold text-slate-900">
          Anything to note? (optional)
        </label>
        <textarea
          id="checkin-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Pain, mood, anything at all"
          className="rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-lg text-slate-900 placeholder:text-slate-500"
        />
      </div>

      <p aria-live="polite" className={status === "idle" ? "sr-only" : "text-lg font-medium text-slate-900"}>
        {status === "loading" && "Building a workout that fits today…"}
        {status === "error" && "Something went wrong on our end. Your check-in is saved — please try again."}
      </p>

      <div className="mt-auto pt-4">
        <Button type="button" onClick={submit} disabled={!energy || status === "loading"}>
          {status === "loading" ? "Building your workout…" : "Create today's workout"}
        </Button>
      </div>
    </div>
  );
}
