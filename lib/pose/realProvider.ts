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
import { mirrorLandmarkTriple, usesInvertedAngle } from "./exercises";
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
 * - `onError`: the model/WASM load can fail (blocked or flaky CDN — AGENTS
 *   §5b flags venue Wi-Fi). Loading is async, so the consumer needs a callback
 *   to fall back to manual controls rather than showing "tracking on" forever.
 */
export interface RealPoseProvider extends PoseProvider {
  onLandmarks(cb: (landmarks: LandmarkFrame) => void): void;
  onError(cb: (error: unknown) => void): void;
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

/** Narrows a `PoseProvider` to one that reports async setup failures. */
export function reportsErrors(
  provider: PoseProvider,
): provider is RealPoseProvider {
  return "onError" in provider;
}

/** Smoothed joint angle + min landmark visibility for one 3-landmark triple. */
interface SideMeasurement {
  angle: number | null;
  visibility: number;
}

/**
 * Angle at the vertex of one landmark triple, or null when any of the three
 * points is missing or below the visibility threshold (counting pauses silently
 * in that case). MediaPipe normalizes x and y to the frame independently, so a
 * non-square video distorts angles — x is aspect-corrected before measuring.
 */
function measureTriple(
  landmarks: LandmarkFrame,
  triple: readonly [number, number, number],
  aspect: number,
): SideMeasurement {
  const first = landmarks?.[triple[0]];
  const vertex = landmarks?.[triple[1]];
  const third = landmarks?.[triple[2]];
  if (!first || !vertex || !third) return { angle: null, visibility: 0 };

  const visibility = Math.min(
    first.visibility ?? 1,
    vertex.visibility ?? 1,
    third.visibility ?? 1,
  );
  if (visibility < VISIBILITY_THRESHOLD) return { angle: null, visibility };

  const correct = (point: NormalizedLandmark) => ({
    x: point.x * aspect,
    y: point.y,
  });
  const angle = calculateAngle(correct(first), correct(vertex), correct(third));
  return { angle, visibility };
}

/** Convert a raw joint angle to the effort-oriented value (see
 * `usesInvertedAngle`): flexing movements are measured as `180 - angle`. */
function toEffortAngle(measurement: SideMeasurement, invert: boolean): SideMeasurement {
  if (!invert || measurement.angle === null) return measurement;
  return { angle: 180 - measurement.angle, visibility: measurement.visibility };
}

/**
 * The angle to count against for this frame, resolved for single-limb tracking
 * (T13). An explicit `left`/`right` side tracks exactly its one triple. `either`
 * tracks whichever arm is actually working: it measures both sides and takes the
 * higher shoulder angle among those in frame, so raising *either* arm counts.
 * This is arm selection, never a left-vs-right comparison or judgment
 * (AGENTS.md §5b). Visibility is the better of the two sides, so one arm out of
 * frame never pauses counting.
 */
export function measureActiveSide(
  landmarks: LandmarkFrame,
  exercise: ExerciseDef,
  aspect: number,
): SideMeasurement {
  const invert = usesInvertedAngle(exercise.id);
  const primary = toEffortAngle(
    measureTriple(landmarks, exercise.landmarks, aspect),
    invert,
  );
  if (exercise.side !== "either") return primary;

  const mirrored = toEffortAngle(
    measureTriple(landmarks, mirrorLandmarkTriple(exercise.landmarks), aspect),
    invert,
  );
  const angles = [primary.angle, mirrored.angle].filter(
    (angle): angle is number => angle !== null,
  );
  return {
    angle: angles.length ? Math.max(...angles) : null,
    visibility: Math.max(primary.visibility, mirrored.visibility),
  };
}

export function createRealPoseProvider(): RealPoseProvider {
  return new RealMediaPipeProvider();
}

class RealMediaPipeProvider implements RealPoseProvider {
  private frameCallbacks: Array<(frame: PoseFrame) => void> = [];
  private repEventCallbacks: Array<(event: RepEvent) => void> = [];
  private landmarkCallbacks: Array<(landmarks: LandmarkFrame) => void> = [];
  private errorCallbacks: Array<(error: unknown) => void> = [];

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

  onError(cb: (error: unknown) => void): void {
    this.errorCallbacks.push(cb);
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
    let landmarker: PoseLandmarker;
    try {
      const { FilesetResolver, PoseLandmarker } = await import(
        "@mediapipe/tasks-vision"
      );
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);

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
    } catch (error) {
      // The WASM/model failed to load (blocked or flaky CDN). Loading is async,
      // so report it back rather than leaving the caller showing "tracking on"
      // forever — it falls back to manual controls (AGENTS §5b, graceful
      // degradation). Guard on running so a stop()-during-load stays silent.
      if (this.running) {
        this.running = false;
        this.emitError(error);
      }
      return;
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

    const aspect = video.videoWidth / video.videoHeight || 1;
    const { angle: rawAngle, visibility } = measureActiveSide(
      landmarks,
      exercise,
      aspect,
    );

    let angleDeg: number | null = null;
    if (rawAngle !== null) {
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

  private emitError(error: unknown): void {
    for (const callback of this.errorCallbacks) callback(error);
  }
}
