"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { RangeArc } from "@/components/RangeArc";
import { announceRepCount } from "@/lib/speech";
import { POSE_EXERCISES } from "@/lib/pose/exercises";
import {
  createRealPoseProvider,
  isPausable,
  providesLandmarks,
  reportsErrors,
  type LandmarkFrame,
} from "@/lib/pose/realProvider";
import { VISIBILITY_THRESHOLD } from "@/lib/pose/repCounter";
import type {
  ExerciseDef,
  PersonalRange,
  PoseFrame,
  PoseProvider,
  RepEvent,
  SafeMovementStats,
} from "@/types";

const VISIBLE_UPPER_BODY_INDICES = [11, 12, 13, 14, 15, 16] as const;
const FRAMING_GUIDANCE = "Move back a little so I can see your arms.";

type CameraState =
  | "idle"
  | "requesting"
  | "ready"
  | "denied"
  | "unavailable"
  | "error";

interface PoseTrackerProps {
  exercise?: ExerciseDef;
  personalRange?: PersonalRange;
  onManualDone?: () => void;
  onPeakRom?: (degrees: number) => void;
  onRepCount?: (count: number) => void;
  onMovementStats?: (stats: SafeMovementStats) => void;
  /** Full RepEvent stream (rep / range_reached / tracking_paused / resumed) --
   * the /exercise screen (T11) uses it to drive voice announcements. */
  onRepEvent?: (event: RepEvent) => void;
  /** Controlled pause: freezes counting without tearing the camera down. */
  paused?: boolean;
  /** Fires when live tracking starts (true) or stops (false) -- lets a parent
   * screen enable its own pause control only while tracking is active. */
  onActiveChange?: (active: boolean) => void;
  /** Increment to request a camera start from the parent (the "start" voice
   * command, T17). Ignored while the camera is already starting or running. */
  startSignal?: number;
  /** Test/demo escape hatch. Production uses real MediaPipe tracking by default. */
  providerFactory?: () => PoseProvider;
}

const DEFAULT_RANGE: PersonalRange = { minDeg: 15, maxDeg: 95 };

const DEFAULT_EXERCISE: ExerciseDef = POSE_EXERCISES[0];

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getConsistencyPercent(
  repPeakAngles: readonly number[],
  personalRange: PersonalRange,
): number | null {
  if (repPeakAngles.length < 2) return null;

  const averagePeak =
    repPeakAngles.reduce((total, angle) => total + angle, 0) /
    repPeakAngles.length;
  const averageDifference =
    repPeakAngles.reduce(
      (total, angle) => total + Math.abs(angle - averagePeak),
      0,
    ) / repPeakAngles.length;
  const rangeSpan = Math.max(1, personalRange.maxDeg - personalRange.minDeg);

  return Math.round(
    clampNumber(100 - (averageDifference / rangeSpan) * 100, 0, 100),
  );
}

function getCameraStateFromError(error: unknown): CameraState {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "denied";
  }

  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "unavailable";
  }

  return "error";
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

/** Real overlay: the actual upper-body landmarks tracked on the live video. */
function drawMediaPipeLandmarks(
  canvas: HTMLCanvasElement,
  landmarks: LandmarkFrame,
): void {
  const context = canvas.getContext("2d");
  if (!context) return;

  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  if (!landmarks) return;

  // Marigold from the design tokens, so the overlay reads as part of the brand.
  context.fillStyle = "#e5a83c";
  for (const index of VISIBLE_UPPER_BODY_INDICES) {
    const point = landmarks[index];
    if (!point) continue;
    drawPoint(context, { x: point.x * width, y: point.y * height });
  }
}

function drawLimb(
  context: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
): void {
  const [firstPoint, ...rest] = points;
  if (!firstPoint) return;

  context.beginPath();
  context.moveTo(firstPoint.x, firstPoint.y);
  for (const point of rest) {
    context.lineTo(point.x, point.y);
  }
  context.stroke();
}

/** Synthetic overlay for the mock provider, which has no real landmarks. */
function drawSyntheticSkeleton(
  canvas: HTMLCanvasElement,
  frame: PoseFrame,
): void {
  const context = canvas.getContext("2d");
  if (!context) return;

  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);

  const centerX = width / 2;
  const shoulderY = height * 0.32;
  const hipY = height * 0.7;
  const armLength = Math.min(width, height) * 0.2;
  const angleRad = ((frame.angleDeg - 90) * Math.PI) / 180;
  const visible = frame.visibility >= VISIBILITY_THRESHOLD;

  const leftShoulder = { x: centerX - width * 0.12, y: shoulderY };
  const rightShoulder = { x: centerX + width * 0.12, y: shoulderY };
  const leftHip = { x: centerX - width * 0.08, y: hipY };
  const rightHip = { x: centerX + width * 0.08, y: hipY };
  const leftElbow = {
    x: leftShoulder.x - Math.cos(angleRad) * armLength,
    y: leftShoulder.y - Math.sin(angleRad) * armLength,
  };
  const rightElbow = {
    x: rightShoulder.x + Math.cos(angleRad) * armLength,
    y: rightShoulder.y - Math.sin(angleRad) * armLength,
  };
  const leftWrist = {
    x: leftElbow.x - Math.cos(angleRad) * armLength * 0.9,
    y: leftElbow.y - Math.sin(angleRad) * armLength * 0.9,
  };
  const rightWrist = {
    x: rightElbow.x + Math.cos(angleRad) * armLength * 0.9,
    y: rightElbow.y - Math.sin(angleRad) * armLength * 0.9,
  };

  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 6;
  context.strokeStyle = visible ? "#e8798f" : "#8a7d66";
  context.fillStyle = visible ? "#e8798f" : "#8a7d66";

  drawLimb(context, [
    leftShoulder,
    rightShoulder,
    rightHip,
    leftHip,
    leftShoulder,
  ]);
  drawLimb(context, [leftShoulder, leftElbow, leftWrist]);
  drawLimb(context, [rightShoulder, rightElbow, rightWrist]);

  for (const point of [
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
  ]) {
    drawPoint(context, point);
  }
}

export function PoseTracker({
  exercise = DEFAULT_EXERCISE,
  personalRange = DEFAULT_RANGE,
  onManualDone,
  onPeakRom,
  onRepCount,
  onMovementStats,
  onRepEvent,
  paused = false,
  onActiveChange,
  startSignal = 0,
  providerFactory,
}: PoseTrackerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const providerRef = useRef<PoseProvider | null>(null);
  const hasLandmarkFeedRef = useRef(false);
  const peakAngleRef = useRef(0);
  const sessionStartedAtRef = useRef<number | null>(null);
  const activeMillisecondsRef = useRef(0);
  const lastActiveFrameAtRef = useRef<number | null>(null);
  const currentRepPeakRef = useRef(0);
  const lastRepAtRef = useRef<number | null>(null);
  const repPeakAnglesRef = useRef<number[]>([]);
  const repDurationsMsRef = useRef<number[]>([]);
  const mountedRef = useRef(false);

  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [statusText, setStatusText] = useState(
    "Camera tracking is optional. You can start it or continue manually.",
  );
  const [repCount, setRepCount] = useState(0);
  const [angleDeg, setAngleDeg] = useState<number | null>(null);
  const [peakAngle, setPeakAngle] = useState(0);
  const [manualDone, setManualDone] = useState(false);
  const [showFramingGuidance, setShowFramingGuidance] = useState(false);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const rect = video.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
  }, []);

  const publishMovementStats = useCallback(
    (targetReps: number) => {
      if (!onMovementStats) return;

      const elapsedMilliseconds =
        sessionStartedAtRef.current === null
          ? 0
          : Math.max(0, Date.now() - sessionStartedAtRef.current);
      const restMilliseconds = Math.max(
        0,
        elapsedMilliseconds - activeMillisecondsRef.current,
      );

      const averageRepSeconds =
        repDurationsMsRef.current.length === 0
          ? null
          : Math.round(
              repDurationsMsRef.current.reduce(
                (total, duration) => total + duration,
                0,
              ) /
                repDurationsMsRef.current.length /
                100,
            ) / 10;

      onMovementStats({
        repsInTargetRange: targetReps,
        movementConsistencyPercent: getConsistencyPercent(
          repPeakAnglesRef.current,
          personalRange,
        ),
        averageRepSeconds,
        activeSeconds: Math.round(activeMillisecondsRef.current / 1000),
        restSeconds: Math.round(restMilliseconds / 1000),
      });
    },
    [onMovementStats, personalRange],
  );

  const recordActiveFrame = useCallback(
    (frame: PoseFrame) => {
      if (frame.visibility < VISIBILITY_THRESHOLD) {
        lastActiveFrameAtRef.current = null;
        return;
      }

      const previousTimestamp = lastActiveFrameAtRef.current;
      if (previousTimestamp !== null) {
        const elapsed = clampNumber(
          frame.timestamp - previousTimestamp,
          0,
          500,
        );
        activeMillisecondsRef.current += elapsed;
      }

      lastActiveFrameAtRef.current = frame.timestamp;
      currentRepPeakRef.current = Math.max(
        currentRepPeakRef.current,
        frame.angleDeg,
      );
      publishMovementStats(repCount);
    },
    [publishMovementStats, repCount],
  );

  const handleFrame = useCallback(
    (frame: PoseFrame) => {
      // Ignore frames while the parent has paused the session. The real
      // (pausable) provider already stops its loop, but this also makes
      // `paused` effective for non-pausable providers (e.g. the T03 mock),
      // so counting/announcements are always suppressed on pause.
      if (!mountedRef.current || paused) return;

      setAngleDeg(frame.angleDeg);
      recordActiveFrame(frame);

      // Track the running peak in a ref so the state update stays a pure value
      // and the onPeakRom side effect (a parent setState on /exercise) runs
      // here in the frame callback -- never inside a setState updater, which
      // executes during render and must not update another component.
      const nextPeak = Math.max(peakAngleRef.current, frame.angleDeg);
      if (nextPeak > peakAngleRef.current) {
        peakAngleRef.current = nextPeak;
        setPeakAngle(nextPeak);
        onPeakRom?.(Math.round(nextPeak));
      }

      // Mock provider only: draw the synthetic skeleton from the angle. The
      // real provider draws actual landmarks via the onLandmarks feed instead.
      if (!hasLandmarkFeedRef.current) {
        const canvas = canvasRef.current;
        if (canvas) {
          resizeCanvas();
          drawSyntheticSkeleton(canvas, frame);
        }
      }
    },
    [onPeakRom, paused, recordActiveFrame, resizeCanvas],
  );

  const handleLandmarks = useCallback(
    (landmarks: LandmarkFrame) => {
      if (!mountedRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      resizeCanvas();
      drawMediaPipeLandmarks(canvas, landmarks);
    },
    [resizeCanvas],
  );

  const handleRepEvent = useCallback(
    (event: RepEvent) => {
      // Suppress rep events while the parent has paused (see handleFrame) so a
      // non-pausable provider can't keep counting/announcing during a pause.
      if (!mountedRef.current || paused) return;
      onRepEvent?.(event);

      if (event.type === "rep") {
        setRepCount(event.count);
        onRepCount?.(event.count);
        const now = Date.now();
        const previousRepAt =
          lastRepAtRef.current ?? sessionStartedAtRef.current;
        if (previousRepAt !== null && now > previousRepAt) {
          repDurationsMsRef.current.push(now - previousRepAt);
        }
        lastRepAtRef.current = now;
        if (currentRepPeakRef.current > 0) {
          repPeakAnglesRef.current.push(currentRepPeakRef.current);
        }
        currentRepPeakRef.current = 0;
        publishMovementStats(event.count);
        setStatusText(`Rep ${event.count} counted.`);
        // T09: speak the count (cancel-before-speak, global mute honoured).
        announceRepCount(event.count);
        return;
      }

      if (event.type === "range_reached") {
        setStatusText(exercise.cues.rangeReached);
        return;
      }

      if (event.type === "tracking_paused") {
        lastActiveFrameAtRef.current = null;
        setAngleDeg(null);
        setShowFramingGuidance(true);
        setStatusText(FRAMING_GUIDANCE);
        return;
      }

      setShowFramingGuidance(false);
      setStatusText("Tracking resumed.");
    },
    [
      exercise.cues.rangeReached,
      onRepCount,
      onRepEvent,
      paused,
      publishMovementStats,
    ],
  );

  // The provider is long-lived (wired once at start), so it must always invoke
  // the latest handler logic -- e.g. toggling voice mid-session updates
  // onRepEvent. Route its callbacks through refs to avoid stale closures.
  const handleFrameRef = useRef(handleFrame);
  const handleLandmarksRef = useRef(handleLandmarks);
  const handleRepEventRef = useRef(handleRepEvent);
  useEffect(() => {
    handleFrameRef.current = handleFrame;
    handleLandmarksRef.current = handleLandmarks;
    handleRepEventRef.current = handleRepEvent;
  }, [handleFrame, handleLandmarks, handleRepEvent]);

  const frameWrapper = useCallback(
    (frame: PoseFrame) => handleFrameRef.current(frame),
    [],
  );
  const repEventWrapper = useCallback(
    (event: RepEvent) => handleRepEventRef.current(event),
    [],
  );
  const landmarksWrapper = useCallback(
    (landmarks: LandmarkFrame) => handleLandmarksRef.current(landmarks),
    [],
  );

  const teardownProvider = useCallback(() => {
    providerRef.current?.stop();
    providerRef.current = null;
    hasLandmarkFeedRef.current = false;
  }, []);

  // The model/WASM load can fail async (blocked or flaky CDN). Fall back to the
  // manual controls instead of leaving the camera "on" with no tracking, and
  // never imply the user's body/setup is at fault (AGENTS Section 5b).
  const handleProviderError = useCallback(() => {
    if (!mountedRef.current) return;
    teardownProvider();
    stopStream(videoRef.current);
    setCameraState("error");
    setAngleDeg(null);
    setShowFramingGuidance(false);
    setStatusText(
      "Camera tracking couldn't start on this connection. You can continue manually.",
    );
  }, [teardownProvider]);

  const stopCamera = useCallback(() => {
    teardownProvider();
    stopStream(videoRef.current);
    setCameraState("idle");
    setAngleDeg(null);
    setShowFramingGuidance(false);
    setStatusText("Camera tracking is off. Manual controls are available.");
  }, [teardownProvider]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unavailable");
      setStatusText("Camera tracking is not available in this browser.");
      return;
    }

    setCameraState("requesting");
    setStatusText("Requesting camera access.");

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        setCameraState("error");
        setStatusText(
          "Camera setup was interrupted. Manual controls are available.",
        );
        return;
      }

      video.srcObject = stream;
      await video.play();

      setRepCount(0);
      peakAngleRef.current = 0;
      sessionStartedAtRef.current = Date.now();
      activeMillisecondsRef.current = 0;
      lastActiveFrameAtRef.current = null;
      currentRepPeakRef.current = 0;
      lastRepAtRef.current = null;
      repPeakAnglesRef.current = [];
      repDurationsMsRef.current = [];
      setPeakAngle(0);
      setAngleDeg(null);
      setShowFramingGuidance(false);
      publishMovementStats(0);

      // Swap point (TICKETS.md T07/T11): the real MediaPipe provider is the
      // default; tests and demos inject the T03 mock via providerFactory.
      const provider = providerFactory?.() ?? createRealPoseProvider();
      providerRef.current = provider;
      hasLandmarkFeedRef.current = providesLandmarks(provider);

      provider.onFrame(frameWrapper);
      provider.onRepEvent(repEventWrapper);
      if (providesLandmarks(provider)) provider.onLandmarks(landmarksWrapper);
      if (reportsErrors(provider)) provider.onError(handleProviderError);
      provider.setRange(personalRange);
      provider.start(video, exercise);
      if (paused && isPausable(provider)) provider.pause();

      resizeCanvas();
      setCameraState("ready");
      setStatusText(
        // "Ready when you are" (not "Resume...") keeps the exact command word
        // out of this aria-live line, so a screen reader speaking it aloud
        // can't echo-trigger the "resume" voice command (lib/voice.ts).
        paused
          ? "Tracking is paused. Ready when you are."
          : "Camera tracking is on. Video stays on this device.",
      );
    } catch (error: unknown) {
      stream?.getTracks().forEach((track) => track.stop());
      const nextState = getCameraStateFromError(error);
      setCameraState(nextState);
      setShowFramingGuidance(false);
      setStatusText(
        nextState === "denied"
          ? "Camera access was not enabled. You can continue manually."
          : "Camera tracking is unavailable. You can continue manually.",
      );
    }
  }, [
    exercise,
    frameWrapper,
    repEventWrapper,
    landmarksWrapper,
    handleProviderError,
    paused,
    personalRange,
    providerFactory,
    publishMovementStats,
    resizeCanvas,
  ]);

  const completeManually = useCallback(() => {
    setManualDone(true);
    publishMovementStats(repCount);
    setStatusText("Exercise marked complete manually.");
    onManualDone?.();
  }, [onManualDone, publishMovementStats, repCount]);

  // Reflect the controlled `paused` prop onto the live provider.
  useEffect(() => {
    if (paused) lastActiveFrameAtRef.current = null;
    if (cameraState !== "ready") return;
    const provider = providerRef.current;
    if (!provider || !isPausable(provider)) return;
    if (paused) provider.pause();
    else provider.resume();
  }, [paused, cameraState]);

  // Tell a parent screen when live tracking is (in)active.
  useEffect(() => {
    onActiveChange?.(cameraState === "ready");
  }, [cameraState, onActiveChange]);

  // A parent can request a camera start (voice "start", T17). Track the last
  // handled value so camera-state changes never replay a stale request --
  // e.g. turning the camera off must not immediately restart it.
  const handledStartSignalRef = useRef(0);
  useEffect(() => {
    if (!startSignal || startSignal === handledStartSignalRef.current) return;
    handledStartSignalRef.current = startSignal;
    if (cameraState === "ready" || cameraState === "requesting") return;
    // Deferred a tick so startCamera's state updates land outside the effect
    // body (same pattern as the instruction autoplay on /exercise).
    const timer = setTimeout(() => void startCamera(), 0);
    return () => clearTimeout(timer);
  }, [startSignal, cameraState, startCamera]);

  useEffect(() => {
    mountedRef.current = true;
    const video = videoRef.current;
    window.addEventListener("resize", resizeCanvas);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("resize", resizeCanvas);
      providerRef.current?.stop();
      providerRef.current = null;
      stopStream(video);
    };
  }, [resizeCanvas]);

  const cameraUnavailable =
    cameraState === "denied" ||
    cameraState === "unavailable" ||
    cameraState === "error";

  // Stage buttons live on the dark surface, so they use milk styles instead of
  // the cream Button component. Focus rings flip to milk via .on-dark.
  const stagePrimary =
    "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-milk px-6 text-lg font-bold text-ink transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50";
  const stageSecondary =
    "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full border-2 border-milk px-6 text-lg font-bold text-milk transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section
      className="on-dark rounded-3xl bg-stage p-4 shadow-card sm:p-5"
      aria-labelledby="pose-tracker-title"
    >
      <div className="space-y-1">
        <h2
          id="pose-tracker-title"
          className="font-display text-xl font-bold text-milk"
        >
          Optional camera tracking
        </h2>
        <p className="text-base text-milk-soft">
          Start the camera for hands-free rep counting. Video is processed on
          this device and is not uploaded.
        </p>
      </div>

      <div
        className="mt-4 overflow-hidden rounded-2xl bg-[#3a332b]"
        role="img"
        aria-label="Live camera preview with shoulder, elbow, and wrist landmarks for rep tracking."
      >
        <div className="relative aspect-video w-full">
          <video
            ref={videoRef}
            className="h-full w-full -scale-x-100 object-cover"
            playsInline
            muted
            aria-label={`Camera preview for ${exercise.name}`}
          />
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
            aria-hidden="true"
          />

          {cameraState !== "ready" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#3a332b] p-4 text-center text-milk-soft">
              <span
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10"
              >
                <Camera className="h-6 w-6" />
              </span>
              <p className="max-w-xs">
                Camera tracking is optional. Use the controls below to start
                tracking or continue manually.
              </p>
            </div>
          ) : null}

          {cameraState === "ready" && paused ? (
            <div className="absolute inset-0 flex items-center justify-center bg-stage/70 p-4 text-center">
              <p className="rounded-full bg-milk px-6 py-2 text-lg font-bold text-ink">
                Paused
              </p>
            </div>
          ) : null}

          {cameraState === "ready" && showFramingGuidance && !paused ? (
            <div className="absolute inset-0 flex items-center justify-center bg-stage/70 p-4 text-center">
              <div className="max-w-sm rounded-2xl bg-milk p-4 shadow-card">
                <h3 className="font-display text-lg font-bold text-ink">
                  Camera framing
                </h3>
                <p className="mt-1 text-base text-ink-soft">
                  {FRAMING_GUIDANCE}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {cameraState === "ready" ? (
        <RangeArc
          className="mt-4"
          currentAngle={angleDeg}
          peakAngle={peakAngle}
          range={personalRange}
        />
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-mint px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-evergreen">
          Reps
        </p>
        <p className="text-3xl font-bold tabular-nums text-ink">{repCount}</p>
      </div>

      <p className="mt-4 text-base text-milk-soft" aria-live="polite">
        {statusText}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        {cameraState === "ready" ? (
          <button type="button" className={stageSecondary} onClick={stopCamera}>
            Turn camera off
          </button>
        ) : (
          <button
            type="button"
            className={stagePrimary}
            onClick={startCamera}
            disabled={cameraState === "requesting"}
          >
            {cameraState === "requesting"
              ? "Starting camera"
              : "Start camera tracking"}
          </button>
        )}

        <button
          type="button"
          className={stageSecondary}
          onClick={completeManually}
        >
          {manualDone ? "Marked complete" : "Done manually"}
        </button>
      </div>

      {cameraUnavailable ? (
        <div className="mt-4 rounded-2xl bg-white/10 p-4 text-milk-soft">
          <h3 className="font-display font-bold text-milk">
            Continue without camera
          </h3>
          <p className="mt-1">
            Follow the written instructions and use the manual button when you
            are ready to move on.
          </p>
        </div>
      ) : null}
    </section>
  );
}
