import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  GenerateWorkoutRequestSchema,
  WorkoutSchema,
} from "@/types";
import { EXERCISES, filterExercisesForAbilities } from "@/lib/exercises";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
    const response = await anthropic.messages.parse({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      system:
        "You generate adaptive fitness workouts for disabled users. " +
        "Only use exercise_ids from the provided library. Energy 1-2 means " +
        "<=10 minutes and <=4 steps with generous rest; energy 4-5 can run " +
        "up to 25 minutes. Never include exercises outside the user's " +
        "positions/equipment. adaptation_note must be practical and warm, " +
        "never medical advice.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
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
        },
      ],
      output_config: { format: zodOutputFormat(WorkoutSchema) },
    });

    if (!response.parsed_output) {
      return NextResponse.json(
        { error: "model returned invalid workout" },
        { status: 502 },
      );
    }

    return NextResponse.json(response.parsed_output);
  } catch {
    return NextResponse.json(
      { error: "workout generation failed" },
      { status: 502 },
    );
  }
}
