import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EnergyLevel, SessionSummary } from "@/types";

interface CheckinSummary {
  energy: EnergyLevel;
  date: string; // ISO date (yyyy-mm-dd)
}

interface HistoryState {
  sessions: SessionSummary[];
  checkins: CheckinSummary[];
  addSession: (session: SessionSummary) => void;
  addCheckin: (checkin: CheckinSummary) => void;
}

/** Local effort/consistency log powering the progress view (F6). Persisted
 * in the browser so progress works without a Supabase login; session
 * writeback to Supabase happens separately when signed in. */
export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      sessions: [],
      checkins: [],
      addSession: (session) =>
        set((state) =>
          state.sessions.some((existing) => existing.id === session.id)
            ? state
            : { sessions: [...state.sessions, session] },
        ),
      addCheckin: (checkin) =>
        set((state) => ({
          checkins: [
            ...state.checkins.filter((c) => c.date !== checkin.date),
            checkin,
          ],
        })),
    }),
    { name: "af-history" },
  ),
);
