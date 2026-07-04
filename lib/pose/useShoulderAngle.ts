import { useEffect, useRef, useState } from "react";
import type { NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";

// Keep in sync with the installed @mediapipe/tasks-vision version.
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// Upper-body landmarks only (Section 5b) — lower body is ignored entirely.
const LEFT = { shoulder: 11, elbow: 13, hip: 23 };
const RIGHT = { shoulder: 12, elbow: 14, hip: 24 };

export const MIN_VISIBILITY = 0.6;
export const EMA_ALPHA = 0.3; // tremor users may need ≈0.15 (Section 5b).

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

export type PoseStatus = "loading" | "tracking" | "unavailable";

interface UseShoulderAngleOptions {
  /** When false, the camera and model are torn down (graceful degradation). */
  enabled: boolean;
  /**
   * Fired once per processed frame with the EMA-smoothed shoulder angle in
   * degrees, or `null` when required landmarks aren't visible. Called through
   * a ref so a fresh closure never re-runs the camera effect or re-renders.
   */
  onAngle?: (degrees: number | null) => void;
}

/**
 * Shared client-side MediaPipe pipeline (Section 5b, F9). Owns getUserMedia,
 * the PoseLandmarker, the rAF loop and EMA smoothing; hands the smoothed angle
 * to the caller. Consumed by both live rep counting (PoseTracker) and
 * calibration (T08) so the motion-tracking implementation lives in one place.
 */
export function useShoulderAngle({ enabled, onAngle }: UseShoulderAngleOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<PoseStatus>("loading");
  const onAngleRef = useRef(onAngle);

  useEffect(() => {
    onAngleRef.current = onAngle;
  }, [onAngle]);

  useEffect(() => {
    if (!enabled) return;

    let landmarker: PoseLandmarker | null = null;
    let stream: MediaStream | null = null;
    let frameId = 0;
    let cancelled = false;
    let smoothed: number | null = null;

    const loop = () => {
      const video = videoRef.current;
      if (!cancelled && landmarker && video && video.readyState >= 2) {
        const result = landmarker.detectForVideo(video, performance.now());
        const landmarks = result.landmarks[0];
        // Track whichever side is more visible right now.
        const angle = landmarks
          ? shoulderAngle(landmarks, LEFT) ?? shoulderAngle(landmarks, RIGHT)
          : null;
        if (angle === null) {
          onAngleRef.current?.(null);
        } else {
          smoothed =
            smoothed === null ? angle : smoothed + EMA_ALPHA * (angle - smoothed);
          onAngleRef.current?.(smoothed);
        }
      }
      if (!cancelled) frameId = requestAnimationFrame(loop);
    };

    const start = async () => {
      try {
        setStatus("loading"); // reset when the camera is (re-)enabled.
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
  }, [enabled]);

  return { videoRef, status };
}
