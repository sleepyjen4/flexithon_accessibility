import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { ExerciseDemo } from "@/components/ExerciseDemo";
import { getExerciseVideoUrl } from "@/lib/exerciseVideos";
import {
  filterExercisesByLibraryCard,
  getLibraryCard,
  getLibraryRow,
  getLibraryStaticParams,
} from "@/lib/exerciseLibrary";
import type { ExerciseLibraryGroupId } from "@/lib/exerciseLibrary";

interface LibraryValuePageProps {
  params: Promise<{
    group: string;
    value: string;
  }>;
}

export function generateStaticParams() {
  return getLibraryStaticParams();
}

export default async function LibraryValuePage({
  params,
}: LibraryValuePageProps) {
  const { group, value } = await params;
  const row = getLibraryRow(group);
  const card = getLibraryCard(group, value);

  if (!row || !card) notFound();

  const exercises = filterExercisesByLibraryCard(
    row.id as ExerciseLibraryGroupId,
    card.id,
  );

  return (
    <DashboardShell>
      <div className="flex flex-col gap-8">
        <Link
          href="/library"
          className="rise-in inline-flex min-h-12 w-fit items-center gap-2 rounded-full border-2 border-ink bg-surface px-5 text-base font-bold text-ink transition-colors hover:bg-mint"
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          Library
        </Link>

        <header className="rise-in rise-in-2 space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-raspberry">
            {row.label}
          </p>
          <h1 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">
            {card.label}
          </h1>
          <p className="text-lg text-ink-soft">
            {exercises.length}{" "}
            {exercises.length === 1 ? "exercise" : "exercises"}
          </p>
        </header>

        <div className="rise-in rise-in-3 grid gap-4 md:grid-cols-2">
          {exercises.map((exercise) => {
            const videoUrl = getExerciseVideoUrl(exercise.id);
            return (
            <Link
              key={exercise.id}
              href={`/exercise/${exercise.id}`}
              className="group flex flex-col gap-3 rounded-3xl border border-line bg-surface p-6 text-left shadow-card transition-colors hover:border-evergreen hover:bg-mint"
              aria-label={`Start ${exercise.name}`}
            >
              {videoUrl ? (
                <ExerciseDemo
                  videoUrl={videoUrl}
                  name={exercise.name}
                  interactive={false}
                />
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-2xl font-bold text-ink">
                  {exercise.name}
                </h2>
                <ArrowRight
                  aria-hidden="true"
                  className="mt-1 h-5 w-5 shrink-0 text-raspberry transition-transform group-hover:translate-x-1"
                />
              </div>
              <p className="text-base text-ink-soft">
                {exercise.description}
              </p>
            </Link>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
