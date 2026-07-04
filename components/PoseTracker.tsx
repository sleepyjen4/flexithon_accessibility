"use client";

import { useEffect, useRef, useState } from "react";
import type { NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PersonalRange } from "@/types";
import { useCalibrationStore } from "@/store/calibration";
import { emaStep, visibleJointAngleDegrees, type AnglePoint } from "@/lib/pose/angle";
import {
  initialRepCounterState,
  stepRepCounter,
  thresholdsFromRange,
  DEFAULT_THRESHOLDS,
  type RepThresholds,
} from "@/lib/pose/repCounter";
import { Timer } from "@/components/Timer";
import { Button } from "@/components/Button";

// Keep in sync with the installed @mediapipe/tasks-vision version.
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// Upper-body landmarks only (Section 5b) — lower body is ignored entirely.
const LEFT = { shoulder: 11, elbow: 13, hip: 23 };
const RIGHT = { shoulder: 12, elbow: 14, hip: 24 };

const CALIBRATION_SECONDS = 10;
const MIN_CALIBRATION_SPAN_DEG = 20;

/** Shoulder abduction angle: at the shoulder, between the arm
 * (shoulder→elbow) and the torso (shoulder→hip). */
function shoulderAngle(landmarks: NormalizedLandmark[], side: typeof LEFT): number | null {
  const shoulder = landmarks[side.shoulder];
  const elbow = landmarks[side.elbow];
  const hip = landmarks[side.hip];
  if (!shoulder || !elbow || !hip) return null;
  return visibleJointAngleDegrees(elbow as AnglePoint, shoulder as AnglePoint, hip as AnglePoint);
}

interface PoseTrackerProps {
  exerciseId: string;
  onPeakRom?: (degrees: number) => void;
}

/** F9: on-device rep counting + peak range-of-motion for the hero
 * exercise, scored against the person's own calibrated range rather than a
 * fixed angle. Video never leaves the browser. Never judges form. */
export function PoseTracker({ exerciseId, onPeakRom }: PoseTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "tracking" | "unavailable">("loading");

  const range = useCalibrationStore((state) => state.ranges[exerciseId]);
  const setRange = useCalibrationStore((state) => state.setRange);
  const [mode, setMode] = useState<"calibrating" | "counting">(() =>
    range ? "counting" : "calibrating",
  );
  const [calibrationHint, setCalibrationHint] = useState<string | null>(null);
  const [repCount, setRepCount] = useState(0);
  const [peakRom, setPeakRom] = useState(0);

  const onPeakRomRef = useRef(onPeakRom);
  const modeRef = useRef(mode);
  const thresholds: RepThresholds = range ? thresholdsFromRange(range) : DEFAULT_THRESHOLDS;
  const thresholdsRef = useRef(thresholds);
  const calibrationMinRef = useRef<number | null>(null);
  const calibrationMaxRef = useRef<number | null>(null);

  useEffect(() => {
    onPeakRomRef.current = onPeakRom;
  }, [onPeakRom]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    thresholdsRef.current = thresholds;
  }, [thresholds]);

  const finishCalibration = () => {
    const min = calibrationMinRef.current;
    const max = calibrationMaxRef.current;
    const span = min !== null && max !== null ? max - min : 0;
    if (min !== null && max !== null && span >= MIN_CALIBRATION_SPAN_DEG) {
      const learned: PersonalRange = { minDeg: min, maxDeg: max };
      setRange(exerciseId, learned);
      setCalibrationHint(null);
    } else {
      setCalibrationHint(
        "We couldn't detect enough movement that time — counting will use standard settings for now. You can recalibrate any time.",
      );
    }
    calibrationMinRef.current = null;
    calibrationMaxRef.current = null;
    setMode("counting");
  };

  const skipCalibration = () => {
    calibrationMinRef.current = null;
    calibrationMaxRef.current = null;
    setMode("counting");
  };

  useEffect(() => {
    let landmarker: PoseLandmarker | null = null;
    let stream: MediaStream | null = null;
    let frameId = 0;
    let cancelled = false;
    let smoothed: number | null = null;
    let repState = initialRepCounterState();

    const loop = () => {
      const video = videoRef.current;
      if (!cancelled && landmarker && video && video.readyState >= 2) {
        const result = landmarker.detectForVideo(video, performance.now());
        const landmarks = result.landmarks[0];
        if (landmarks) {
          // Track whichever side is more visible right now.
          const angle = shoulderAngle(landmarks, LEFT) ?? shoulderAngle(landmarks, RIGHT);
          if (angle !== null) {
            smoothed = emaStep(smoothed, angle);
            if (modeRef.current === "calibrating") {
              calibrationMinRef.current =
                calibrationMinRef.current === null ? smoothed : Math.min(calibrationMinRef.current, smoothed);
              calibrationMaxRef.current =
                calibrationMaxRef.current === null ? smoothed : Math.max(calibrationMaxRef.current, smoothed);
            } else {
              const previousPeak = repState.peakDeg;
              const previousCount = repState.repCount;
              repState = stepRepCounter(repState, smoothed, thresholdsRef.current);
              if (repState.repCount !== previousCount) setRepCount(repState.repCount);
              if (repState.peakDeg > previousPeak) {
                setPeakRom(Math.round(repState.peakDeg));
                onPeakRomRef.current?.(Math.round(repState.peakDeg));
              }
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
          : mode === "calibrating"
            ? "Learning your comfortable range…"
            : `${repCount} ${repCount === 1 ? "rep" : "reps"}`}
      </p>

      {status === "tracking" && mode === "calibrating" && (
        <div className="flex flex-col gap-3 rounded-2xl bg-indigo-50 p-4">
          <p className="text-lg text-slate-900">
            Move your arm out to the side and back down a few times, only as
            far as feels comfortable today. We&apos;ll count from your range,
            not anyone else&apos;s.
          </p>
          <Timer seconds={CALIBRATION_SECONDS} label="Calibration" onComplete={finishCalibration} />
          <Button type="button" variant="secondary" onClick={finishCalibration}>
            I&apos;m ready — start counting
          </Button>
          <Button type="button" variant="secondary" onClick={skipCalibration}>
            Skip — use standard settings
          </Button>
        </div>
      )}

      {status === "tracking" && mode === "counting" && (
        <>
          {calibrationHint && (
            <p aria-live="polite" className="text-base text-slate-600">
              {calibrationHint}
            </p>
          )}
          <p className="text-center text-lg text-slate-600">
            Peak range of motion: {peakRom}°
          </p>
        </>
      )}

      <p className="text-center text-base text-slate-600">
        Video stays on your device — nothing is uploaded or stored.
      </p>
    </div>
  );
}
