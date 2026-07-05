import Link from "next/link";
import type { MetadataCard } from "@/lib/exerciseLibrary";
import { metadataRows } from "@/lib/exerciseLibrary";

function MetadataValueCard({ card }: { card: MetadataCard }) {
  return (
    <Link
      href={card.href}
      className="flex min-h-28 w-40 shrink-0 flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-indigo-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      aria-label={`View ${card.count} ${card.label} ${card.count === 1 ? "exercise" : "exercises"}`}
    >
      <h3 className="text-lg font-bold text-slate-900">{card.label}</h3>
      <p className="text-base font-medium text-slate-600">
        {card.count} {card.count === 1 ? "exercise" : "exercises"}
      </p>
    </Link>
  );
}

export function ExerciseLibraryDashboard() {
  return (
    <div className="flex flex-col gap-8">
      {metadataRows.map((row) => (
        <section key={row.id} aria-labelledby={`${row.id}-heading`}>
          <h2
            id={`${row.id}-heading`}
            className="mb-3 text-2xl font-bold text-slate-900"
          >
            {row.label}
          </h2>
          <div
            className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-2"
            aria-label={`${row.label} options`}
          >
            {row.cards.map((card) => (
              <MetadataValueCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
