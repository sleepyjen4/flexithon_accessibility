/**
 * Pre-generates instruction audio for the seeded exercises (AGENTS.md
 * Section 5c). Writes public/audio/<id>.<ext> and regenerates lib/audioManifest.ts.
 * Build-time only — never runs inside the app.
 *
 * Providers (tried in order, first working one is used for the whole run):
 *   1. Gemini / Google AI Studio — needs GEMINI_API_KEY (reuses the app key)
 *   2. Google Cloud TTS (fallback)— needs GOOGLE_TTS_API_KEY
 * Force one with TTS_PROVIDER=gemini|google.
 *
 * Usage:  npm run generate:audio   (GEMINI_API_KEY is already in .env)
 *
 * Excluded from the app tsconfig (see tsconfig.json "exclude"); run with tsx.
 */
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { EXERCISES } from "../lib/exercises";
import { STATIC_CLIPS } from "../lib/staticAudio";
import { EXERCISE_AUDIO, STATIC_AUDIO } from "../lib/audioManifest";

// Next auto-loads .env for the app, but a standalone tsx script does not, so
// load it ourselves before reading any secrets. .env.local wins over .env
// (Next precedence); loadEnvFile does not override already-set process.env.
for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(process.cwd(), envFile);
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

// Gemini / Google AI Studio (primary). Kore is a warm, clear female voice;
// override with GEMINI_TTS_VOICE / GEMINI_TTS_MODEL.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-2.5-flash-preview-tts";
const GEMINI_TTS_VOICE = process.env.GEMINI_TTS_VOICE ?? "Kore";

// Google Cloud TTS (fallback). Neural2-F is a warm female en-US voice.
const GOOGLE_TTS_KEY = process.env.GOOGLE_TTS_API_KEY;
const GOOGLE_TTS_VOICE = process.env.GOOGLE_TTS_VOICE ?? "en-US-Neural2-F";
const GOOGLE_TTS_LANGUAGE_CODE = process.env.GOOGLE_TTS_LANGUAGE_CODE ?? "en-US";

const AUDIO_DIR = path.join(process.cwd(), "public", "audio");
const MANIFEST_PATH = path.join(process.cwd(), "lib", "audioManifest.ts");

type SeedExercise = (typeof EXERCISES)[number];

/** Matches the static portion the player reads aloud: name + instructions.
 * The dynamic adaptation_note is intentionally excluded (Section 5c). */
function instructionText(exercise: SeedExercise): string {
  return [exercise.name, ...exercise.instructions.map((step) => step.text)].join(". ");
}

// --- Gemini / Google AI Studio -------------------------------------------

/** Pulls the sample rate out of a mime type like "audio/L16;rate=24000". */
function parseSampleRate(mimeType: string | undefined): number {
  const match = mimeType ? /rate=(\d+)/.exec(mimeType) : null;
  return match ? Number(match[1]) : 24000;
}

/** Wraps raw signed-16-bit little-endian mono PCM in a WAV container so the
 * browser <audio> element can play it (Gemini TTS returns bare PCM). */
function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bitsPerSample = 16): Buffer {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // audio format = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Retry logic wrapper for transient API errors (5xx). Exponential backoff:
 * 1s, 2s, 4s. Gives up after 3 attempts total (8s+ elapsed). */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      // Check if it's a transient 5xx error worth retrying
      const is5xx =
        error instanceof Error &&
        error.message.includes('"status":"INTERNAL"') &&
        error.message.includes('"code":500');

      if (!is5xx || attempt === maxAttempts) {
        throw error;
      }

      const backoffMs = Math.pow(2, attempt - 1) * 1000;
      console.warn(
        `Transient API error (attempt ${attempt}/${maxAttempts}); retrying in ${backoffMs}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
}

async function synthesizeGemini(ai: GoogleGenAI, text: string): Promise<Buffer> {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: GEMINI_TTS_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_TTS_VOICE } },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const inline = parts.find((part) => part.inlineData?.data)?.inlineData;
    if (!inline?.data) {
      throw new Error("Gemini returned no audio data");
    }

    const pcm = Buffer.from(inline.data, "base64");
    return pcmToWav(pcm, parseSampleRate(inline.mimeType));
  });
}

// --- Google Cloud TTS -----------------------------------------------------

/** Google Cloud TTS fallback — no shared-voice restriction, generous free tier.
 * Uses API-key auth against the REST endpoint; returns decoded MP3 bytes. */
async function synthesizeGoogle(text: string): Promise<Buffer> {
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY as string}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: GOOGLE_TTS_LANGUAGE_CODE, name: GOOGLE_TTS_VOICE },
        audioConfig: { audioEncoding: "MP3" },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Google TTS ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { audioContent?: string };
  if (!data.audioContent) {
    throw new Error("Google TTS returned no audioContent");
  }

  return Buffer.from(data.audioContent, "base64");
}

// --- Provider selection ---------------------------------------------------

interface Provider {
  name: string;
  /** Output file extension (Gemini emits WAV, the REST providers emit MP3). */
  ext: string;
  synth: (text: string) => Promise<Buffer>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Providers to attempt, in priority order. Honors a TTS_PROVIDER override,
 * otherwise includes whichever are configured (Gemini first, then Google Cloud TTS). */
function providerOrder(): string[] {
  const override = process.env.TTS_PROVIDER?.trim().toLowerCase();
  if (override === "gemini") return ["gemini"];
  if (override === "google") return ["google"];

  const order: string[] = [];
  if (GEMINI_API_KEY) order.push("gemini");
  if (GOOGLE_TTS_KEY) order.push("google");
  return order;
}

/** Builds a provider, resolving any per-provider setup. Throws if the provider 
 * isn't configured or setup fails. */
async function buildProvider(name: string): Promise<Provider> {
  if (name === "gemini") {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    console.log(`Using Gemini voice: ${GEMINI_TTS_VOICE} (${GEMINI_TTS_MODEL})`);
    return { name: "Gemini (AI Studio)", ext: "wav", synth: (text) => synthesizeGemini(ai, text) };
  }

  if (name === "google") {
    if (!GOOGLE_TTS_KEY) throw new Error("GOOGLE_TTS_API_KEY not set");
    console.log(`Using Google Cloud voice: ${GOOGLE_TTS_VOICE} (${GOOGLE_TTS_LANGUAGE_CODE})`);
    return { name: "Google Cloud TTS", ext: "mp3", synth: (text) => synthesizeGoogle(text) };
  }

  throw new Error(`Unknown TTS provider: ${name}`);
}

function renderMap(manifest: Record<string, string>): string {
  const entries = Object.entries(manifest)
    .map(([id, url]) => `  ${JSON.stringify(id)}: ${JSON.stringify(url)},`)
    .join("\n");
  return entries ? `\n${entries}\n` : "";
}

function renderManifest(
  exerciseManifest: Record<string, string>,
  staticManifest: Record<string, string>,
): string {
  return `import type { Exercise } from "@/types";
import type { StaticClipId } from "@/lib/staticAudio";

/**
 * Maps exercise id -> pre-generated instruction audio URL (Section 5c).
 * GENERATED by scripts/generate-audio.ts — do not edit by hand. Empty until
 * audio is generated, in which case the player falls back to the Web Speech API.
 */
export const EXERCISE_AUDIO: Record<string, string> = {${renderMap(exerciseManifest)}};

/**
 * Maps static-clip id (rest cue, etc.) -> pre-generated audio URL (Section 5c).
 * GENERATED by scripts/generate-audio.ts — do not edit by hand. Empty until
 * audio is generated, in which case the player falls back to the Web Speech API.
 */
export const STATIC_AUDIO: Partial<Record<StaticClipId, string>> = {${renderMap(staticManifest)}};

/** The instruction-audio URL for an exercise, or null to use Web Speech.
 * Prefers the seed's \`audio_url\`, then the generated manifest. */
export function getExerciseAudioUrl(
  exercise: Pick<Exercise, "id" | "audio_url">,
): string | null {
  return exercise.audio_url ?? EXERCISE_AUDIO[exercise.id] ?? null;
}

/** The pre-generated URL for a static clip (e.g. the rest cue), or null to use
 * Web Speech. */
export function getStaticAudioUrl(id: StaticClipId): string | null {
  return STATIC_AUDIO[id] ?? null;
}
`;
}

/**
 * Selects a provider by probing on the first exercise, keeping that audio so
 * the call isn't wasted. Tries providers in order and falls back to the next
 * on any failure (setup or synthesis), so one provider is used for the whole
 * run — never a mix of voices.
 */
async function selectProvider(
  order: string[],
  probeText: string,
): Promise<{ provider: Provider; audio: Buffer }> {
  let lastError: unknown;

  for (const name of order) {
    try {
      const provider = await buildProvider(name);
      const audio = await provider.synth(probeText);
      return { provider, audio };
    } catch (error) {
      lastError = error;
      console.warn(`${name} unavailable: ${errorMessage(error)}`);
    }
  }

  throw lastError ?? new Error("No TTS provider is configured or usable.");
}

interface ClipJob {
  id: string;
  text: string;
  kind: "exercise" | "static";
}

function exerciseJobs(): ClipJob[] {
  return EXERCISES.map((exercise) => ({
    id: exercise.id,
    text: instructionText(exercise),
    kind: "exercise",
  }));
}

// Static, non-exercise lines the player speaks (the rest cue, etc.) — same
// voice as the exercises, so rest and exercise speech sound like one narrator.
function staticJobs(): ClipJob[] {
  return Object.entries(STATIC_CLIPS).map(([id, text]) => ({ id, text, kind: "static" }));
}

async function main(): Promise<void> {
  const order = providerOrder();
  if (order.length === 0) {
    console.error(
      "No TTS provider configured. Set GEMINI_API_KEY " +
        "(or GOOGLE_TTS_API_KEY as a fallback). Aborting.",
    );
    process.exit(1);
  }

  // --static-only (or STATIC_ONLY=1): regenerate just the static clips (the
  // rest cue) and leave the exercise clips untouched — no full 36-clip rerun.
  const staticOnly =
    process.argv.includes("--static-only") || process.env.STATIC_ONLY === "1";

  const jobs = staticOnly ? staticJobs() : [...exerciseJobs(), ...staticJobs()];

  // In a full run, wipe the dir so stale clips from a previous provider
  // (different extension) don't linger unreferenced. In a static-only run,
  // keep the existing exercise clips and their manifest entries intact.
  if (!staticOnly) {
    await rm(AUDIO_DIR, { recursive: true, force: true });
  }
  await mkdir(AUDIO_DIR, { recursive: true });

  const exerciseManifest: Record<string, string> = staticOnly ? { ...EXERCISE_AUDIO } : {};
  const staticManifest: Record<string, string> = staticOnly ? { ...STATIC_AUDIO } : {};

  const recordClip = async (job: ClipJob, audio: Buffer, provider: Provider) => {
    const filename = `${job.id}.${provider.ext}`;
    await writeFile(path.join(AUDIO_DIR, filename), audio);
    const target = job.kind === "static" ? staticManifest : exerciseManifest;
    target[job.id] = `/audio/${filename}`;
  };

  // Probe on the first job to lock in one provider, keeping its audio so the
  // call isn't wasted.
  const [firstJob, ...restJobs] = jobs;
  process.stdout.write(`Generating ${firstJob.id}... `);
  const { provider, audio: firstAudio } = await selectProvider(order, firstJob.text);
  console.log(`done (via ${provider.name})`);
  await recordClip(firstJob, firstAudio, provider);

  for (const job of restJobs) {
    process.stdout.write(`Generating ${job.id}... `);
    const audio = await provider.synth(job.text);
    await recordClip(job, audio, provider);
    console.log("done");
  }

  await writeFile(MANIFEST_PATH, renderManifest(exerciseManifest, staticManifest));
  console.log(
    `\nWrote ${jobs.length} clip${jobs.length === 1 ? "" : "s"} ` +
      `(via ${provider.name}) + ${MANIFEST_PATH}`,
  );
}

void main();
