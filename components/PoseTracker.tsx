"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createMockPoseProvider as createPoseProvider } from "@/lib/pose/mockProvider";
import { Button } from "@/components/Button";
import type {
  ExerciseDef,
  PersonalRange,
  PoseFrame,
  PoseProvider,
  RepEvent,
} from "@/types";

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
  providerFactory?: () => PoseProvider;
}

const DEFAULT_RANGE: PersonalRange = { minDeg: 20, maxDeg: 150 };

const DEFAULT_EXERCISE: ExerciseDef = {
  id: "seated_arm_raise",
  name: "Seated arm raise",
  landmarks: [11, 13, 15],
  side: "either",
  instructions: [
    "Sit in a supported position.",
    "Raise one arm toward a comfortable range.",
    "Lower your arm when you are ready.",
  ],
  cues: {
    rangeReached: "You reached your target range.",
    encourage: ["Move within today’s comfortable range.", "Pause whenever you need."],
  },
};

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
  context.arc(point.x, point.y, 8, 0, Math.PI * 2);
  context.fill();
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

function drawMockSkeleton(canvas: HTMLCanvasElement, frame: PoseFrame): void {
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
  const visible = frame.visibility >= 0.6;

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
  context.strokeStyle = visible ? "#4F46E5" : "#64748B";
  context.fillStyle = visible ? "#4F46E5" : "#64748B";

  drawLimb(context, [leftShoulder, rightShoulder, rightHip, leftHip, leftShoulder]);
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
  providerFactory = createPoseProvider,
}: PoseTrackerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const providerRef = useRef<PoseProvider | null>(null);
  const mountedRef = useRef(false);

  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [statusText, setStatusText] = useState(
    "Camera tracking is optional. You can start it or continue manually.",
  );
  const [repCount, setRepCount] = useState(0);
  const [angleDeg, setAngleDeg] = useState<number | null>(null);
  const [peakAngle, setPeakAngle] = useState(0);
  const [manualDone, setManualDone] = useState(false);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const rect = video.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
  }, []);

  const handleFrame = useCallback(
    (frame: PoseFrame) => {
      if (!mountedRef.current) return;

      resizeCanvas();
      setAngleDeg(frame.angleDeg);
      setPeakAngle((currentPeak) => {
        const nextPeak = Math.max(currentPeak, frame.angleDeg);
        onPeakRom?.(Math.round(nextPeak));
        return nextPeak;
      });

      const canvas = canvasRef.current;
      if (canvas) {
        drawMockSkeleton(canvas, frame);
      }
    },
    [onPeakRom, resizeCanvas],
  );

  const handleRepEvent = useCallback(
    (event: RepEvent) => {
      if (!mountedRef.current) return;

      if (event.type === "rep") {
        setRepCount(event.count);
        onRepCount?.(event.count);
        setStatusText(`Rep ${event.count} counted.`);
        return;
      }

      if (event.type === "range_reached") {
        setStatusText(exercise.cues.rangeReached);
        return;
      }

      if (event.type === "tracking_paused") {
        setStatusText("Tracking is paused while the camera view is limited.");
        return;
      }

      setStatusText("Tracking resumed.");
    },
    [exercise.cues.rangeReached, onRepCount],
  );

  const stopCamera = useCallback(() => {
    providerRef.current?.stop();
    providerRef.current = null;
    stopStream(videoRef.current);
    setCameraState("idle");
    setStatusText("Camera tracking is off. Manual controls are available.");
  }, []);

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
        setStatusText("Camera setup was interrupted. Manual controls are available.");
        return;
      }

      video.srcObject = stream;
      await video.play();

      const provider = providerFactory();
      providerRef.current = provider;
      provider.onFrame(handleFrame);
      provider.onRepEvent(handleRepEvent);
      provider.setRange(personalRange);
      provider.start(video, exercise);

      resizeCanvas();
      setCameraState("ready");
      setStatusText("Camera tracking is on. Video stays on this device.");
    } catch (error: unknown) {
      stream?.getTracks().forEach((track) => track.stop());
      const nextState = getCameraStateFromError(error);
      setCameraState(nextState);
      setStatusText(
        nextState === "denied"
          ? "Camera access was not enabled. You can continue manually."
          : "Camera tracking is unavailable. You can continue manually.",
      );
    }
  }, [
    exercise,
    handleFrame,
    handleRepEvent,
    personalRange,
    providerFactory,
    resizeCanvas,
  ]);

  const completeManually = useCallback(() => {
    setManualDone(true);
    setStatusText("Exercise marked complete manually.");
    onManualDone?.();
  }, [onManualDone]);

  useEffect(() => {
    mountedRef.current = true;
    const video = videoRef.current;
    window.addEventListener("resize", resizeCanvas);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("resize", resizeCanvas);
      providerRef.current?.stop();
      stopStream(video);
    };
  }, [resizeCanvas]);

  const cameraUnavailable =
    cameraState === "denied" || cameraState === "unavailable" || cameraState === "error";

  return (
    <section
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
      aria-labelledby="pose-tracker-title"
    >
      <div className="space-y-2">
        <h2 id="pose-tracker-title" className="text-xl font-bold text-slate-900">
          Optional camera tracking
        </h2>
        <p className="text-base text-slate-600">
          Start the camera for hands-free rep counting. Video is processed on this
          device and is not uploaded.
        </p>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-slate-50">
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
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 p-4 text-center text-slate-600">
              <p>
                Camera tracking is optional. Use the controls below to start tracking or
                continue manually.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-600">Reps</p>
          <p className="text-3xl font-bold text-slate-900">{repCount}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-600">Current angle</p>
          <p className="text-3xl font-bold text-slate-900">
            {angleDeg === null ? "—" : `${Math.round(angleDeg)}°`}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-600">Peak today</p>
          <p className="text-3xl font-bold text-slate-900">{Math.round(peakAngle)}°</p>
        </div>
      </div>

      <p className="mt-4 text-base text-slate-600" aria-live="polite">
        {statusText}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        {cameraState === "ready" ? (
          <Button type="button" variant="secondary" onClick={stopCamera}>
            Turn camera off
          </Button>
        ) : (
          <Button
            type="button"
            onClick={startCamera}
            disabled={cameraState === "requesting"}
          >
            {cameraState === "requesting" ? "Starting camera" : "Start camera tracking"}
          </Button>
        )}

        <Button type="button" variant="secondary" onClick={completeManually}>
          {manualDone ? "Marked complete" : "Done manually"}
        </Button>
      </div>

      {cameraUnavailable ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
          <h3 className="font-semibold text-slate-900">Continue without camera</h3>
          <p className="mt-1">
            Follow the written instructions and use the manual button when you are ready
            to move on.
          </p>
        </div>
      ) : null}
    </section>
  );
}
