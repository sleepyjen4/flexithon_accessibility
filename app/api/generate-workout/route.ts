import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import {
  GenerateWorkoutRequestSchema,
  WorkoutSchema,
} from "@/types";
import { EXERCISES, ensureHeroExerciseStep, filterExercisesForAbilities, HERO_EXERCISE_ID } from "@/lib/exercises";

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Reuses the same zod schema the client validates against (Section 5) so the
// model's output shape can never drift from the contract in types.ts.
const workoutJsonSchema = z.toJSONSchema(WorkoutSchema);

const SYSTEM_INSTRUCTION =
  "You generate adaptive fitness workouts for disabled users. " +
  "Only use exercise_ids from the provided library. Energy 1-2 means " +
  "<=10 minutes and <=4 steps with generous rest; energy 4-5 can run " +
  "up to 25 minutes. Never include exercises outside the user's " +
  "positions/equipment. adaptation_note must be practical and warm, " +
  `never medical advice. If "${HERO_EXERCISE_ID}" is in the available ` +
  "exercise list, include it as one of the steps — it's the app's " +
  "hands-free camera rep-counting exercise.";

export async function POST(request: Request) {
  const parsedRequest = GenerateWorkoutRequestSchema.safeParse(
    await request.json(),
  );
  if (!parsedRequest.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const { profile, energy, recent_session_ids } = parsedRequest.data;

  const availableExercises = filterExercisesForAbilities(
    profile.abilities,
    EXERCISES,
  );
  if (availableExercises.length === 0) {
    return NextResponse.json(
      { error: "no exercises available for this profile" },
      { status: 422 },
    );
  }

  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: JSON.stringify({
        energy,
        recent_session_ids,
        available_exercises: availableExercises.map((exercise) => ({
          exercise_id: exercise.id,
          name: exercise.name,
          positions: exercise.positions,
          equipment: exercise.equipment,
          body_regions: exercise.body_regions,
          intensity: exercise.intensity,
        })),
      }),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseJsonSchema: workoutJsonSchema,
      },
    });

    if (!response.text) {
      return NextResponse.json(
        { error: "model returned invalid workout" },
        { status: 502 },
      );
    }

    const parsedWorkout = WorkoutSchema.safeParse(JSON.parse(response.text));
    if (!parsedWorkout.success) {
      return NextResponse.json(
        { error: "model returned invalid workout" },
        { status: 502 },
      );
    }

    const workout = ensureHeroExerciseStep(parsedWorkout.data, availableExercises, energy);
    return NextResponse.json(workout);
  } catch {
    return NextResponse.json(
      { error: "workout generation failed" },
      { status: 502 },
    );
  }
}
