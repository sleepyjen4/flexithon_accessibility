import Link from "next/link";
import { Button } from "@/components/Button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-white px-6 py-16 text-center">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Adaptive Fitness
        </h1>
        <p className="max-w-md text-lg text-slate-600">
          A fitness app that adapts to your body and your energy today.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-4">
        <Link href="/onboarding">
          <Button>Get started</Button>
        </Link>
      </div>
    </div>
  );
}
