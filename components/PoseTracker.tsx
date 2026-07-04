"use client";

import { useEffect, useRef, useState } from "react";
import type { NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";

// Keep in sync with the installed @mediapipe/tasks-vision version.
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// Upper-body landmarks only (Section 5b) — lower body is ignored entirely.
const LEFT = { shoulder: 11, elbow: 13, hip: 23 };
const RIGHT = { shoulder: 12, elbow: 14, hip: 24 };

const MIN_VISIBILITY = 0.6;
const EMA_ALPHA = 0.3;
const REP_UP_DEGREES = 80; // hysteresis: count "up" past 80°...
const REP_DOWN_DEGREES = 30; // ...and re-arm only after dropping below 30°.

/** Shoulder abduction angle: at the shoulder, between the arm
 * (shoulder→elbow) and the torso (shoulder→hip). */
function shoulderAngle(
  landmarks: NormalizedLandmark[],
  side: typeof LEFT,
): number | null {
  const points = [landmarks[side.shoulder], landmarks[side.elbow], landmarks[side.hip]];
  if (points.some((p) => !p || (p.visibility ?? 0) < MIN_VISIBILITY)) {
    return null; // Landmarks dropped out — pause counting silently.
  }
  const [shoulder, elbow, hip] = points;
  const arm = { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y };
  const torso = { x: hip.x - shoulder.x, y: hip.y - shoulder.y };
  const dot = arm.x * torso.x + arm.y * torso.y;
  const magnitudes = Math.hypot(arm.x, arm.y) * Math.hypot(torso.x, torso.y);
  if (magnitudes === 0) return null;
  return (Math.acos(Math.min(1, Math.max(-1, dot / magnitudes))) * 180) / Math.PI;
}

interface PoseTrackerProps {
  onPeakRom?: (degrees: number) => void;
}

/** F9: on-device rep counting + peak range-of-motion for the hero
 * exercise. Video never leaves the browser. Never judges form. */
export function PoseTracker({ onPeakRom }: PoseTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "tracking" | "unavailable">("loading");
  const [repCount, setRepCount] = useState(0);
  const [peakRom, setPeakRom] = useState(0);
  const onPeakRomRef = useRef(onPeakRom);

  useEffect(() => {
    onPeakRomRef.current = onPeakRom;
  }, [onPeakRom]);

  useEffect(() => {
    let landmarker: PoseLandmarker | null = null;
    let stream: MediaStream | null = null;
    let frameId = 0;
    let cancelled = false;
    let smoothed: number | null = null;
    let armRaised = false;
    let peak = 0;

    const loop = () => {
      const video = videoRef.current;
      if (!cancelled && landmarker && video && video.readyState >= 2) {
        const result = landmarker.detectForVideo(video, performance.now());
        const landmarks = result.landmarks[0];
        if (landmarks) {
          // Track whichever side is more visible right now.
          const angle = shoulderAngle(landmarks, LEFT) ?? shoulderAngle(landmarks, RIGHT);
          if (angle !== null) {
            smoothed = smoothed === null ? angle : smoothed + EMA_ALPHA * (angle - smoothed);
            if (smoothed > peak) {
              peak = smoothed;
              setPeakRom(Math.round(peak));
              onPeakRomRef.current?.(Math.round(peak));
            }
            if (!armRaised && smoothed > REP_UP_DEGREES) {
              armRaised = true;
              setRepCount((count) => count + 1);
            } else if (armRaised && smoothed < REP_DOWN_DEGREES) {
              armRaised = false;
            }
          }
        }
      }
      if (!cancelled) frameId = requestAnimationFrame(loop);
    };

    const start = async () => {
      try {
        const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
        const created = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) return;
        landmarker = created;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        setStatus("tracking");
        frameId = requestAnimationFrame(loop);
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    };

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((track) => track.stop());
      landmarker?.close();
    };
  }, []);

  if (status === "unavailable") {
    return (
      <p className="rounded-2xl bg-slate-50 p-4 text-lg text-slate-600">
        The camera isn&apos;t available right now. Counting by hand works
        exactly the same — tap Done when you&apos;re finished.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <video
        ref={videoRef}
        muted
        playsInline
        aria-hidden="true"
        className="w-full -scale-x-100 rounded-2xl bg-slate-50"
      />
      <p aria-live="polite" className="text-center text-2xl font-bold text-slate-900">
        {status === "loading"
          ? "Starting camera…"
          : `${repCount} ${repCount === 1 ? "rep" : "reps"}`}
      </p>
      {status === "tracking" && (
        <p className="text-center text-lg text-slate-600">
          Peak range of motion: {peakRom}°
        </p>
      )}
      <p className="text-center text-base text-slate-600">
        Video stays on your device — nothing is uploaded or stored.
      </p>
    </div>
  );
}
