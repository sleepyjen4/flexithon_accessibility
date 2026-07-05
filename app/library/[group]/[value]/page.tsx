import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 bg-white px-6 py-10">
      <Link
        href="/library"
        className="inline-flex min-h-12 w-fit items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 text-base font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        Library
      </Link>

      <header className="space-y-2">
        <p className="text-base font-semibold text-slate-600">{row.label}</p>
        <h1 className="text-3xl font-bold text-slate-900">{card.label}</h1>
        <p className="text-lg text-slate-600">
          {exercises.length}{" "}
          {exercises.length === 1 ? "exercise" : "exercises"}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {exercises.map((exercise) => (
          <Link
            key={exercise.id}
            href={`/exercise/${exercise.id}`}
            className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 text-left transition-colors hover:border-indigo-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            aria-label={`Start ${exercise.name}`}
          >
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">
                {exercise.name}
              </h2>
              <p className="text-base text-slate-600">
                {exercise.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
