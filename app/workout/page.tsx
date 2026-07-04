import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

export default function WorkoutPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 bg-white px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Your workout</h1>
      <div aria-live="polite" className="sr-only" />
      <Card>
        <p className="text-slate-600">
          Workout player (F5) goes here — one exercise per screen, text +
          illustration + optional TTS, pause/extend timers.
        </p>
      </Card>
      <Button variant="secondary">Skip — no penalty</Button>
    </div>
  );
}
