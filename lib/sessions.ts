import type { SessionSummary, Workout } from "@/types";
import { createClient } from "@/lib/supabase/client";

/**
 * Best-effort writeback of a finished session to Supabase. The local
 * history store is the source of truth for the progress view; this only
 * runs when a user is signed in, and failures are silent by design —
 * the demo path must never depend on the network.
 */
export async function saveSessionToSupabase(
  workout: Workout,
  summary: SessionSummary,
  completedStepIndexes: number[],
): Promise<void> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    await supabase.from("sessions").insert({
      user_id: data.user.id,
      // Section 5b: peak ROM lives inside the workout jsonb so F6 can
      // chart range-of-motion over time.
      workout: { ...workout, peak_rom_degrees: summary.peak_rom_degrees },
      completed_steps: completedStepIndexes,
      effort: summary.effort,
    });
  } catch {
    // No Supabase config or no session — local history already has it.
  }
}
