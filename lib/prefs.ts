import type { AccessibilityPrefs } from "@/types";
import { createClient } from "@/lib/supabase/client";

/** Best-effort mirror of accessibility prefs to the Supabase profile (F7).
 * Local persistence is the source of truth; this only runs when signed in. */
export async function savePrefsToSupabase(prefs: AccessibilityPrefs): Promise<void> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("profiles").update({ prefs }).eq("id", data.user.id);
  } catch {
    // No Supabase config or not signed in — local store already has it.
  }
}

/** Applies prefs to the document root so CSS can respond app-wide. */
export function applyPrefsToDocument(prefs: AccessibilityPrefs): void {
  const root = document.documentElement;
  root.dataset.textSize = prefs.text_size;
  root.dataset.contrast = prefs.high_contrast ? "high" : "normal";
  root.dataset.reducedMotion = prefs.reduced_motion ? "true" : "false";
}
