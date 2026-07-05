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
import { calculateAngle } from "./angles";
import { smoothWithEma } from "./smoothing";
import {
  createRepCounter,
  VISIBILITY_THRESHOLD,
  type RepCounter,
} from "./repCounter";

/**
 * T11 (A): the real MediaPipe implementation of the locked `PoseProvider`
 * contract. It wraps the three Saturday PM primitives —
 * `angles.ts` (atan2 joint angle), `smoothing.ts` (EMA), and
 * `repCounter.ts` (hysteresis state machine) — behind exactly the same
 * interface the mock provider (T03) implements, so swapping mock → real is a
 * one-line change (`createMockPoseProvider` → `createRealPoseProvider`).
 *
 * All video frames are processed in-browser via `detectForVideo` and are
 * never uploaded or stored (AGENTS.md §5b, the privacy line in the pitch).
 */

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

// Roughly one second of continuous detect failures at ~30fps. A single frame
// throwing is normal (video not ready); sustained failure is a real signal
// (GPU/WASM problem) worth surfacing once instead of silently retrying forever.
const DETECT_FAILURE_WARN_THRESHOLD = 30;

/** Raw landmark set for the active frame, or null when nobody is detected. */
export type LandmarkFrame = readonly NormalizedLandmark[] | null;

/**
 * Capabilities the real provider offers *beyond* the locked `PoseProvider`
 * contract. Consumers feature-detect these (`"onLandmarks" in provider`) so
 * the mock — which implements only `PoseProvider` — keeps working untouched:
 *
 * - `onLandmarks`: raw landmarks for drawing the on-video skeleton overlay.
 *   Kept off the core contract because the mock has no real landmarks to give.
 * - `pause` / `resume`: freeze counting for the workout player's big pause
 *   button without tearing the camera down. Resume starts a *fresh* rep so a
 *   movement straddling the pause gap can never be counted.
 */
export interface RealPoseProvider extends PoseProvider {
  onLandmarks(cb: (landmarks: LandmarkFrame) => void): void;
  pause(): void;
  resume(): void;
}

/** Narrows a `PoseProvider` to one exposing the raw-landmark overlay feed. */
export function providesLandmarks(
  provider: PoseProvider,
): provider is RealPoseProvider {
  return "onLandmarks" in provider;
}

/** Narrows a `PoseProvider` to one that can pause/resume counting in place. */
export function isPausable(provider: PoseProvider): provider is RealPoseProvider {
  return "pause" in provider;
}

export function createRealPoseProvider(): RealPoseProvider {
  return new RealMediaPipeProvider();
}

class RealMediaPipeProvider implements RealPoseProvider {
  private frameCallbacks: Array<(frame: PoseFrame) => void> = [];
  private repEventCallbacks: Array<(event: RepEvent) => void> = [];
  private landmarkCallbacks: Array<(landmarks: LandmarkFrame) => void> = [];

  private video: HTMLVideoElement | null = null;
  private exercise: ExerciseDef | null = null;
  private landmarker: PoseLandmarker | null = null;
  private range: PersonalRange | null = null;
  private repCounter: RepCounter | null = null;

  private animationId: number | null = null;
  private running = false;
  private paused = false;
  private smoothedAngle: number | null = null;
  private detectFailures = 0;

  start(video: HTMLVideoElement, exercise: ExerciseDef): void {
    this.stop();
    this.video = video;
    this.exercise = exercise;
    this.running = true;
    this.paused = false;
    this.smoothedAngle = null;
    this.repCounter = this.range ? createRepCounter(this.range) : null;
    void this.init();
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.landmarker?.close();
    this.landmarker = null;
    this.repCounter = null;
    this.smoothedAngle = null;
  }

  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    // Start a fresh rep: a movement that straddled the pause must not count.
    this.smoothedAngle = null;
    this.repCounter = this.range ? createRepCounter(this.range) : null;
    this.scheduleFrame();
  }

  onFrame(cb: (frame: PoseFrame) => void): void {
    this.frameCallbacks.push(cb);
  }

  onRepEvent(cb: (event: RepEvent) => void): void {
    this.repEventCallbacks.push(cb);
  }

  onLandmarks(cb: (landmarks: LandmarkFrame) => void): void {
    this.landmarkCallbacks.push(cb);
  }

  setRange(range: PersonalRange): void {
    this.range = range;
    // Recreate the counter through the shared hysteresis machine so real and
    // mock counting can never drift apart (including the degenerate-range
    // guard). Only while actively tracking — otherwise start()/resume() build it.
    if (this.running && !this.paused) {
      this.repCounter = createRepCounter(range);
    }
  }

  private async init(): Promise<void> {
    const { FilesetResolver, PoseLandmarker } = await import(
      "@mediapipe/tasks-vision"
    );
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);

    let landmarker: PoseLandmarker;
    try {
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    } catch {
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    }

    // stop() may have been called while the model loaded — honour it.
    if (!this.running) {
      landmarker.close();
      return;
    }

    this.landmarker = landmarker;
    if (!this.paused) this.scheduleFrame();
  }

  private scheduleFrame(): void {
    this.animationId = requestAnimationFrame(() => this.processFrame());
  }

  private processFrame(): void {
    if (!this.running || this.paused) return;

    const video = this.video;
    const landmarker = this.landmarker;
    const exercise = this.exercise;
    if (!video || !landmarker || !exercise) {
      this.scheduleFrame();
      return;
    }

    let landmarks: LandmarkFrame = null;
    try {
      const result = landmarker.detectForVideo(video, performance.now());
      landmarks = result.landmarks?.[0] ?? null;
      this.detectFailures = 0;
    } catch (error) {
      // A transient detect failure (e.g. video not ready) — try again next
      // frame. Warn once if failures persist, so a real GPU/WASM problem isn't
      // silently retried forever (surfaced, not thrown — tracking is optional).
      this.detectFailures += 1;
      if (this.detectFailures === DETECT_FAILURE_WARN_THRESHOLD) {
        console.warn(
          "[pose] detectForVideo has failed repeatedly; tracking may be degraded.",
          error,
        );
      }
      this.scheduleFrame();
      return;
    }

    this.emitLandmarks(landmarks);

    const [firstIndex, vertexIndex, thirdIndex] = exercise.landmarks;
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

    let angleDeg: number | null = null;
    if (first && vertex && third && visibility >= VISIBILITY_THRESHOLD) {
      // MediaPipe normalizes x and y to the frame independently, so a
      // non-square video distorts angles — aspect-correct x before measuring.
      const aspect = video.videoWidth / video.videoHeight || 1;
      const correct = (point: NormalizedLandmark) => ({
        x: point.x * aspect,
        y: point.y,
      });
      const rawAngle = calculateAngle(
        correct(first),
        correct(vertex),
        correct(third),
      );
      this.smoothedAngle = smoothWithEma(this.smoothedAngle, rawAngle);
      angleDeg = this.smoothedAngle;
    } else {
      this.smoothedAngle = null;
    }

    const timestamp = Date.now();
    if (angleDeg !== null) {
      this.emitFrame({ angleDeg, visibility, timestamp });
    }

    // Always feed the counter: it gates on visibility itself and emits the
    // tracking_paused/resumed events that drive the "move back into frame" UI.
    if (this.repCounter) {
      const counterFrame: PoseFrame = {
        angleDeg: angleDeg ?? Number.NaN,
        visibility,
        timestamp,
      };
      for (const event of this.repCounter.update(counterFrame)) {
        this.emitRepEvent(event);
      }
    }

    this.scheduleFrame();
  }

  private emitFrame(frame: PoseFrame): void {
    for (const callback of this.frameCallbacks) callback(frame);
  }

  private emitRepEvent(event: RepEvent): void {
    for (const callback of this.repEventCallbacks) callback(event);
  }

  private emitLandmarks(landmarks: LandmarkFrame): void {
    for (const callback of this.landmarkCallbacks) callback(landmarks);
  }
}
