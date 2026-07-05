"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { Check, Pause, Play } from "lucide-react";
import type {
  NormalizedLandmark,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import type {
  ExerciseDef,
  PersonalRange,
  PoseFrame,
  PoseProvider,
  RepEvent,
} from "@/types";
import {
  DEFAULT_RANGE,
  createCalibrationCapture,
  computeRange,
  isUsableSweep,
} from "@/lib/calibration";
import { getExerciseById } from "@/lib/exercises";
import {
  CALIBRATION_KEY_BY_POSE_ID,
  POSE_EXERCISES,
  getPoseExerciseById,
  poseExerciseForSide,
  usesInvertedAngle,
} from "@/lib/pose/exercises";
import { calculateAngle } from "@/lib/pose/angles";
import { smoothWithEma } from "@/lib/pose/smoothing";
import { getStaticAudioUrl } from "@/lib/audioManifest";
import { cancelSpeech, speakOrPlay } from "@/lib/speech";
import type { StaticClipId } from "@/lib/staticAudio";
import { useCalibrationStore } from "@/store/calibration";
import { useProfileStore } from "@/store/profile";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

const VISIBLE_UPPER_BODY_INDICES = [11, 12, 13, 14, 15, 16] as const;

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

const TARGET_SWEEPS = 3; // three guided movements (T08).
const MIN_VISIBILITY = 0.6; // pause capture silently below this (matches T06).

type Phase = "pick" | "intro" | "capture" | "review";
type PoseStatus = "loading" | "tracking" | "paused" | "unavailable";

const SIDE_LABEL: Record<ExerciseDef["side"], string> = {
  left: "your left side",
  right: "your right side",
  either: "either side",
};

// Pre-generated Gemini clip for each movement's intro read-aloud (Section 5c).
// The wording lives in STATIC_CLIPS; the fallback text below is composed from
// the same pieces the screen renders so clip and Web Speech never drift.
const CALIBRATION_CLIP_BY_POSE_ID: Record<ExerciseDef["id"], StaticClipId> = {
  seated_arm_raise: "calibrate_seated_arm_raise",
  seated_bicep_curl: "calibrate_seated_bicep_curl",
};

interface CalibrationFlowProps {
  /** Which movement to calibrate (T13). Defaults to the arm-raise hero. */
  exerciseId?: ExerciseDef["id"];
  /** Specific exercise links skip the picker and open the spoken intro. */
  startInIntro?: boolean;
  /** Which side to track while calibrating, so the captured range matches the
   * side the user will actually exercise (T13 single-limb). */
  side?: ExerciseDef["side"];
  /** Test/demo escape hatch. Production uses real MediaPipe tracking by default. */
  providerFactory?: () => PoseProvider;
}

function stopStream(video: HTMLVideoElement | null): void {
  const source = video?.srcObject;

  if (source instanceof MediaStream) {
    for (const track of source.getTracks()) {
      track.stop();
    }
  }

  if (video) {
    video.srcObject = null;
  }
}

function drawPoint(
  context: CanvasRenderingContext2D,
  point: { x: number; y: number },
): void {
  context.beginPath();
  context.arc(point.x, point.y, 5, 0, Math.PI * 2);
  context.fill();
}

function drawMediaPipeLandmarks(
  canvas: HTMLCanvasElement,
  landmarks: readonly NormalizedLandmark[],
): void {
  const context = canvas.getContext("2d");
  if (!context) return;

  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#00ff88";

  for (const index of VISIBLE_UPPER_BODY_INDICES) {
    const point = landmarks[index];
    if (!point) continue;
    drawPoint(context, { x: point.x * width, y: point.y * height });
  }
}

/**
 * T08: guided calibration for the hands-free hero exercise. Records the user's
 * own comfortable min/max shoulder angle over a few movements, stores it as a
 * `PersonalRange`, and heads to the exercise screen. Fully keyboard-operable, and the
 * camera is always optional — the flow never dead-ends.
 */
export function CalibrationFlow({
  exerciseId: initialExerciseId = "seated_arm_raise",
  startInIntro = false,
  side = "either",
  providerFactory,
}: CalibrationFlowProps = {}) {
  const router = useRouter();

  // The exercise being calibrated. Seeded from the query param (when arriving
  // from /exercise) but user-changeable in the "pick" step so /calibrate works
  // as a standalone entry point too.
  const [exerciseId, setExerciseId] =
    useState<ExerciseDef["id"]>(initialExerciseId);

  // Resolve the movement + tracked side once. `poseDef` carries the landmark
  // triple the provider measures; `storeKey` is the library id the range is
  // saved under (see CALIBRATION_KEY_BY_POSE_ID).
  const poseDef = useMemo(() => {
    const base =
      getPoseExerciseById(exerciseId) ?? getPoseExerciseById("seated_arm_raise")!;
    return poseExerciseForSide(base, side);
  }, [exerciseId, side]);
  const storeKey = CALIBRATION_KEY_BY_POSE_ID[poseDef.id];

  const setRange = useCalibrationStore((state) => state.setRange);
  const existing = useCalibrationStore((state) => state.ranges[storeKey]);
  const exercise = getExerciseById(storeKey);

  const [phase, setPhase] = useState<Phase>(startInIntro ? "intro" : "pick");
  const [status, setStatus] = useState<PoseStatus>("loading");
  const [liveDeg, setLiveDeg] = useState<number | null>(null);
  const [captMin, setCaptMin] = useState<number | null>(null);
  const [captMax, setCaptMax] = useState<number | null>(null);
  const [sweeps, setSweeps] = useState(0);

  // Read the intro instructions aloud in the warm Gemini voice (Section 5c).
  const speechEnabled = useProfileStore(
    (state) => state.prefs.speech_enabled !== false,
  );
  const [reading, setReading] = useState(false);
  const readAloudClipId = CALIBRATION_CLIP_BY_POSE_ID[poseDef.id];
  // Compose the spoken text from the same pieces the "What happens" list shows,
  // so the Web Speech fallback matches the pre-generated clip word for word.
  const readAloudText = useMemo(
    () =>
      [
        "Here's what happens.",
        "Sit so your head and arms are in view.",
        ...poseDef.instructions,
        `Repeat gently ${TARGET_SWEEPS} times. We'll do the measuring.`,
      ].join(" "),
    [poseDef],
  );

  const playIntroInstructions = useCallback(() => {
    // Prefer the pre-generated Gemini clip; speakOrPlay falls back to the Web
    // Speech API (with the same text) when no clip has been generated yet, so
    // read-aloud always works. Resolves when it ends, stops, or no-ops (muted).
    setReading(true);
    void speakOrPlay(getStaticAudioUrl(readAloudClipId), readAloudText, {
      interrupt: true,
    }).finally(() => setReading(false));
  }, [readAloudClipId, readAloudText]);

  // Autoplay the intro only when /calibrate is opened for a specific movement,
  // so plain /calibrate stays silent on the chooser. The global speech toggle
  // still governs this because speakOrPlay no-ops while muted.
  const playIntroInstructionsRef = useRef(playIntroInstructions);
  useEffect(() => {
    playIntroInstructionsRef.current = playIntroInstructions;
  }, [playIntroInstructions]);
  useEffect(() => {
    if (!startInIntro || phase !== "intro") return;

    const timer = setTimeout(() => playIntroInstructionsRef.current(), 0);
    return () => clearTimeout(timer);
  }, [startInIntro, phase, exerciseId]);

  // Play/stop toggle: a second tap stops the read-aloud mid-way.
  const toggleReadAloud = useCallback(() => {
    if (reading) {
      cancelSpeech();
      setReading(false);
      return;
    }
    playIntroInstructions();
  }, [reading, playIntroInstructions]);

  // Stop any intro read-aloud when the phase changes (e.g. into capture) or the
  // flow unmounts, so the warm voice never trails into the camera step.
  useEffect(() => () => cancelSpeech(), [phase]);

  // Running capture lives in refs so 30fps updates never re-render.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const providerRef = useRef<PoseProvider | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationRef = useRef<number | null>(null);
  const realFrameRef = useRef<() => void>(() => undefined);
  const captureRef = useRef(createCalibrationCapture());
  const roundedLiveRef = useRef<number | null>(null);
  const smoothedRef = useRef<number | null>(null);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const rect = video.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
  }, []);

  const syncCaptureSnapshot = useCallback(() => {
    const snapshot = captureRef.current.getSnapshot();
    setCaptMin(snapshot.minDeg === null ? null : Math.round(snapshot.minDeg));
    setCaptMax(snapshot.maxDeg === null ? null : Math.round(snapshot.maxDeg));
    setSweeps(snapshot.sweeps);
    if (snapshot.sweeps >= TARGET_SWEEPS) setPhase("review");
  }, []);

  const handleCaptureEvent = useCallback((event: RepEvent) => {
    if (event.type === "tracking_paused") setStatus("paused");
    if (event.type === "tracking_resumed") setStatus("tracking");
  }, []);

  const handleFrame = useCallback(
    (frame: PoseFrame) => {
      if (frame.visibility < MIN_VISIBILITY) {
        for (const event of captureRef.current.update(frame))
          handleCaptureEvent(event);
        return;
      }

      smoothedRef.current = smoothWithEma(smoothedRef.current, frame.angleDeg);
      const smoothedFrame = { ...frame, angleDeg: smoothedRef.current };
      const rounded = Math.round(smoothedFrame.angleDeg);
      if (rounded !== roundedLiveRef.current) {
        roundedLiveRef.current = rounded;
        setLiveDeg(rounded);
      }

      setStatus("tracking");
      for (const event of captureRef.current.update(smoothedFrame))
        handleCaptureEvent(event);
      syncCaptureSnapshot();
    },
    [handleCaptureEvent, syncCaptureSnapshot],
  );

  const stopAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const handleRealFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const poseLandmarker = poseLandmarkerRef.current;
    if (!video || !canvas || !poseLandmarker) return;

    resizeCanvas();
    const result = poseLandmarker.detectForVideo(video, performance.now());
    const landmarks = result.landmarks?.[0];

    if (landmarks) {
      drawMediaPipeLandmarks(canvas, landmarks);
    } else {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }

    const [firstIndex, vertexIndex, thirdIndex] = poseDef.landmarks;
    const first = landmarks?.[firstIndex];
    const vertex = landmarks?.[vertexIndex];
    const third = landmarks?.[thirdIndex];
    const visibility =
      first && vertex && third
        ? Math.min(
            first.visibility ?? 1,
            vertex.visibility ?? 1,
            third.visibility ?? 1,
          )
        : 0;

    if (first && vertex && third && visibility >= MIN_VISIBILITY) {
      const aspect = video.videoWidth / video.videoHeight;
      const correct = (point: NormalizedLandmark) => ({
        x: point.x * aspect,
        y: point.y,
      });
      const rawAngle = calculateAngle(
        correct(first),
        correct(vertex),
        correct(third),
      );
      // Match the provider's effort convention so the captured range and the
      // live counting agree on which direction a rep goes (usesInvertedAngle).
      handleFrame({
        angleDeg: usesInvertedAngle(poseDef.id) ? 180 - rawAngle : rawAngle,
        visibility,
        timestamp: Date.now(),
      });
    } else {
      smoothedRef.current = null;
      handleFrame({ angleDeg: Number.NaN, visibility, timestamp: Date.now() });
    }

    animationRef.current = requestAnimationFrame(() => realFrameRef.current());
  }, [handleFrame, poseDef, resizeCanvas]);

  useEffect(() => {
    realFrameRef.current = handleRealFrame;
  }, [handleRealFrame]);

  // Read angles from real MediaPipe landmarks by default so calibration mirrors
  // the exercise tracker. A providerFactory can still inject the T03 mock in tests.
  useEffect(() => {
    if (phase !== "capture") return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let activeVideo: HTMLVideoElement | null = null;

    const begin = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        activeVideo = video;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }

        if (providerFactory) {
          const provider = providerFactory();
          providerRef.current = provider;
          provider.onFrame((frame) => {
            if (cancelled) return;
            if (frame.visibility < MIN_VISIBILITY) smoothedRef.current = null;
            handleFrame(frame);
          });
          provider.start(video ?? document.createElement("video"), poseDef);
        } else {
          const { FilesetResolver, PoseLandmarker: PoseLandmarkerFactory } =
            await import("@mediapipe/tasks-vision");
          const vision = await FilesetResolver.forVisionTasks(WASM_URL);
          try {
            const landmarker = await PoseLandmarkerFactory.createFromOptions(
              vision,
              {
                baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
                runningMode: "VIDEO",
                numPoses: 1,
              },
            );
            if (cancelled) {
              landmarker.close();
              return;
            }
            poseLandmarkerRef.current = landmarker;
          } catch {
            const landmarker = await PoseLandmarkerFactory.createFromOptions(
              vision,
              {
                baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
                runningMode: "VIDEO",
                numPoses: 1,
              },
            );
            if (cancelled) {
              landmarker.close();
              return;
            }
            poseLandmarkerRef.current = landmarker;
          }
          animationRef.current = requestAnimationFrame(() =>
            realFrameRef.current(),
          );
        }
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    };
    void begin();

    return () => {
      cancelled = true;
      stopAnimation();
      providerRef.current?.stop();
      providerRef.current = null;
      poseLandmarkerRef.current?.close();
      poseLandmarkerRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
      stopStream(activeVideo);
    };
  }, [phase, poseDef, providerFactory, handleFrame, stopAnimation]);

  const beginCapture = () => {
    captureRef.current = createCalibrationCapture();
    roundedLiveRef.current = null;
    smoothedRef.current = null;
    stopAnimation();
    providerRef.current?.stop();
    providerRef.current = null;
    poseLandmarkerRef.current?.close();
    poseLandmarkerRef.current = null;
    stopStream(videoRef.current);
    setCaptMin(null);
    setCaptMax(null);
    setLiveDeg(null);
    setSweeps(0);
    setStatus("loading");
    setPhase("capture");
  };

  const save = (range: PersonalRange) => {
    setRange(storeKey, range);
    router.push("/exercise");
  };

  const saveDefault = () =>
    save({ ...DEFAULT_RANGE, capturedAt: new Date().toISOString() });

  const heading = "Calibrate camera rep counting";

  // ---- Pick exercise -----------------------------------------------------
  if (phase === "pick") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
        <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
        <p className="text-lg text-slate-600">
          Which exercise are you calibrating? We&apos;ll learn your comfortable
          range for it so the camera counts reps that fit your body.
        </p>
        <fieldset className="flex flex-col gap-3 border-0 p-0">
          <legend className="sr-only">Choose an exercise to calibrate</legend>
          <RadioGroup.Root
            value={exerciseId}
            onValueChange={(next) => setExerciseId(next as ExerciseDef["id"])}
            aria-label="Choose an exercise to calibrate"
            className="flex flex-col gap-3"
          >
            {POSE_EXERCISES.map((option) => (
              <RadioGroup.Item
                key={option.id}
                value={option.id}
                className="flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo-600 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-50"
              >
                <span className="text-lg font-semibold text-slate-900">
                  {option.name}
                </span>
                <RadioGroup.Indicator className="shrink-0">
                  <Check aria-hidden="true" className="h-5 w-5 text-indigo-700" />
                </RadioGroup.Indicator>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        </fieldset>
        {existing && (
          <p className="rounded-2xl bg-emerald-50 p-4 text-base text-slate-900">
            You&apos;ve already calibrated this one ({existing.minDeg}°–
            {existing.maxDeg}°). Recalibrating replaces it.
          </p>
        )}
        <div className="mt-auto flex flex-col gap-3 pt-4">
          <Button type="button" onClick={() => setPhase("intro")}>
            Continue
          </Button>
          <Link
            href="/exercise"
            className="min-h-12 content-center text-center text-lg font-medium text-indigo-700 underline underline-offset-4 hover:text-indigo-800"
          >
            Back to exercise
          </Link>
        </div>
      </div>
    );
  }

  // ---- Intro -------------------------------------------------------------
  if (phase === "intro") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
        <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
        <p className="text-lg text-slate-600">
          We&apos;ll learn your comfortable range for the{" "}
          <strong>{exercise?.name ?? "hero exercise"}</strong>
          {side !== "either" ? ` on ${SIDE_LABEL[side]}` : ""} so the camera
          counts reps that fit your body, not the other way around.
        </p>
        {existing && (
          <p className="rounded-2xl bg-emerald-50 p-4 text-lg text-slate-900">
            You&apos;re already calibrated ({existing.minDeg}°–{existing.maxDeg}
            °). You can recalibrate any time.
          </p>
        )}
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              What happens
            </h2>
            {/* Hidden while speech is muted — nothing would play. Mirrors the
                workout player's read-aloud control (ExerciseStep). */}
            {speechEnabled ? (
              <button
                type="button"
                onClick={toggleReadAloud}
                aria-pressed={reading}
                className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                aria-label={
                  reading
                    ? "Stop reading the instructions"
                    : "Read the instructions aloud"
                }
              >
                {reading ? (
                  <Pause aria-hidden="true" className="h-6 w-6" />
                ) : (
                  <Play aria-hidden="true" className="h-6 w-6" />
                )}
              </button>
            ) : null}
          </div>
          <ol className="flex list-decimal flex-col gap-2 pl-6 text-lg text-slate-900">
            <li>Sit so your head and arms are in view.</li>
            {poseDef.instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
            <li>
              Repeat gently {TARGET_SWEEPS} times. We&apos;ll do the measuring.
            </li>
          </ol>
        </Card>
        <p className="text-base text-slate-600">
          Video stays on your device, nothing is uploaded or stored. Prefer not
          to use the camera? You can skip it and still start your workout.
        </p>
        <div className="mt-auto flex flex-col gap-3 pt-4">
          <Button type="button" onClick={beginCapture}>
            {existing ? "Recalibrate with camera" : "Start calibration"}
          </Button>
          <Button type="button" variant="secondary" onClick={saveDefault}>
            Skip camera — use a comfortable default
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPhase("pick")}
          >
            Choose a different exercise
          </Button>
        </div>
      </div>
    );
  }

  // ---- Capture -----------------------------------------------------------
  if (phase === "capture") {
    if (status === "unavailable") {
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
          <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
          <p className="rounded-2xl bg-slate-50 p-4 text-lg text-slate-600">
            The camera isn&apos;t available right now. That&apos;s completely
            fine. We&apos;ll use a comfortable default range, and you can count
            reps by hand.
          </p>
          <div className="mt-auto flex flex-col gap-3 pt-4">
            <Button type="button" onClick={beginCapture}>
              Try camera again
            </Button>
            <Button type="button" variant="secondary" onClick={saveDefault}>
              Use a default range and start
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPhase("intro")}
            >
              Back
            </Button>
          </div>
        </div>
      );
    }

    const captured = Math.min(sweeps, TARGET_SWEEPS);
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6">
        <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
        <p className="text-lg text-slate-600">
          {status === "loading" && "Starting camera…"}
          {status === "tracking" &&
            "Move through the exercise, then return. Nice and gentle."}
          {status === "paused" &&
            "Tracking paused. Move back into view when ready."}
        </p>
        <div
          className="overflow-hidden rounded-2xl bg-slate-50 shadow-sm ring-1 ring-slate-200"
          role="img"
          aria-label="Live camera preview with shoulder, elbow, and wrist landmarks for calibration."
        >
          <div className="relative aspect-video w-full">
            <video
              ref={videoRef}
              muted
              playsInline
              aria-hidden="true"
              className="h-full w-full -scale-x-100 object-cover"
            />
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
              aria-hidden="true"
            />
          </div>
        </div>
        <p
          aria-live="polite"
          className="text-center text-xl font-semibold text-slate-900"
        >
          Movement {captured} of {TARGET_SWEEPS} recorded
        </p>
        {liveDeg !== null && (
          <p className="text-center text-lg text-slate-600">
            Current: {liveDeg}° · so far {captMin ?? "–"}°–{captMax ?? "–"}°
          </p>
        )}
        <div className="mt-auto flex flex-col gap-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPhase("review")}
          >
            Done — save my range
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPhase("intro")}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ---- Review ------------------------------------------------------------
  const usable =
    captMin !== null && captMax !== null && isUsableSweep(captMin, captMax);
  const range = usable
    ? computeRange(captMin as number, captMax as number)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
      {range ? (
        <>
          <p aria-live="polite" className="text-lg text-slate-600">
            Great — your comfortable range is{" "}
            <strong>
              {range.minDeg}° to {range.maxDeg}°
            </strong>
            . Reps will count against this, so hitting your target stays
            realistic.
          </p>
          <div className="mt-auto flex flex-col gap-3 pt-4">
            <Button type="button" onClick={() => save(range)}>
              Save and start exercise
            </Button>
            <Button type="button" variant="secondary" onClick={beginCapture}>
              Recalibrate
            </Button>
          </div>
        </>
      ) : (
        <>
          <p
            aria-live="polite"
            className="rounded-2xl bg-slate-50 p-4 text-lg text-slate-600"
          >
            We didn&apos;t catch a full movement that time. No problem at all.
            Try once more, or start with a comfortable default range.
          </p>
          <div className="mt-auto flex flex-col gap-3 pt-4">
            <Button type="button" onClick={beginCapture}>
              Try again
            </Button>
            <Button type="button" variant="secondary" onClick={saveDefault}>
              Use a default range and start
            </Button>
          </div>
        </>
      )}
      <Link
        href="/exercise"
        className="min-h-12 content-center text-center text-lg font-medium text-indigo-700 underline underline-offset-4 hover:text-indigo-800"
      >
        Skip for now
      </Link>
    </div>
  );
}
