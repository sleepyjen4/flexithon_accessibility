"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  ChevronDown,
  Dumbbell,
  LayoutGrid,
  PersonStanding,
} from "lucide-react";
import type { MetadataCard, MetadataRow } from "@/lib/exerciseLibrary";
import { metadataRows } from "@/lib/exerciseLibrary";
import type { ExerciseLibraryGroupId } from "@/lib/exerciseLibrary";

const ROW_ICONS: Record<ExerciseLibraryGroupId, LucideIcon> = {
  position: PersonStanding,
  equipment: Dumbbell,
  "body-region": Armchair,
  category: LayoutGrid,
};

const ROW_CHIP_CLASSES: Record<ExerciseLibraryGroupId, string> = {
  position: "bg-mint text-evergreen",
  equipment: "bg-lavender text-[#4f4a78]",
  "body-region": "bg-marigold-soft text-marigold-deep",
  category: "bg-raspberry-soft text-raspberry",
};

// Enough to fill one row on a wide screen without a scrollbar; the rest
// collapse behind "Show all" so tall category lists never force scrolling.
const COLLAPSED_COUNT = 6;

function MetadataValueCard({ card }: { card: MetadataCard }) {
  return (
    <Link
      href={card.href}
      className="flex min-h-28 flex-col justify-between rounded-3xl border-2 border-line-strong bg-surface p-4 text-left shadow-card transition-colors hover:border-evergreen hover:bg-mint"
      aria-label={`View ${card.count} ${card.label} ${card.count === 1 ? "exercise" : "exercises"}`}
    >
      <h3 className="font-display text-lg font-bold text-ink">
        {card.label}
      </h3>
      <p className="text-base font-semibold text-ink-soft">
        {card.count} {card.count === 1 ? "exercise" : "exercises"}
      </p>
    </Link>
  );
}

function LibraryRow({ row, delayIndex }: { row: MetadataRow; delayIndex: number }) {
  const Icon = ROW_ICONS[row.id];
  const [expanded, setExpanded] = useState(false);
  const canCollapse = row.cards.length > COLLAPSED_COUNT;
  const visibleCards =
    expanded || !canCollapse ? row.cards : row.cards.slice(0, COLLAPSED_COUNT);

  return (
    <section
      aria-labelledby={`${row.id}-heading`}
      className={`rise-in ${delayIndex > 0 ? `rise-in-${Math.min(delayIndex + 1, 4)}` : ""}`}
    >
      <div className="mb-3 flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${ROW_CHIP_CLASSES[row.id]}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <h2
          id={`${row.id}-heading`}
          className="font-display text-2xl font-bold text-ink"
        >
          {row.label}
        </h2>
      </div>
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        aria-label={`${row.label} options`}
      >
        {visibleCards.map((card) => (
          <MetadataValueCard key={card.id} card={card} />
        ))}
      </div>
      {canCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-ink px-5 text-base font-bold text-ink transition-colors hover:bg-mint"
        >
          <span>
            {expanded ? "Show fewer" : `Show all ${row.cards.length}`}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </section>
  );
}

export function ExerciseLibraryDashboard() {
  return (
    <div className="flex flex-col gap-8">
      {metadataRows.map((row, index) => (
        <LibraryRow key={row.id} row={row} delayIndex={index} />
      ))}
    </div>
  );
}
