import type {
  PersonalRange,
  PoseFrame,
  PoseProvider,
  RepEvent,
} from "@/types";
import { createRepCounter, type RepCounter } from "./repCounter";

const MIN_ANGLE_DEG = 20;
const MAX_ANGLE_DEG = 150;
const PERIOD_MS = 3_000;
const FRAME_MS = 1000 / 30;
const LOW_VISIBILITY = 0.45;
const HIGH_VISIBILITY = 0.95;

export function createMockPoseProvider(): PoseProvider {
  return new MockPoseProvider();
}

class MockPoseProvider implements PoseProvider {
  private frameCallbacks: Array<(frame: PoseFrame) => void> = [];
  private repEventCallbacks: Array<(event: RepEvent) => void> = [];
  private timerId: number | null = null;
  private repCounter: RepCounter | null = null;

  start(): void {
    this.stop();

    const startedAt = performance.now();

    this.timerId = window.setInterval(() => {
      const now = performance.now();
      const progress = ((now - startedAt) % PERIOD_MS) / PERIOD_MS;
      const wave = (1 - Math.cos(progress * Math.PI * 2)) / 2;
      const noise = Math.sin(now / 173) * 2.5;
      const angleDeg = MIN_ANGLE_DEG + wave * (MAX_ANGLE_DEG - MIN_ANGLE_DEG) + noise;
      const visibility = this.visibilityFor(now - startedAt);
      const frame: PoseFrame = {
        angleDeg: Math.round(angleDeg * 10) / 10,
        visibility,
        timestamp: Date.now(),
      };

      this.emitFrame(frame);

      if (this.repCounter) {
        for (const event of this.repCounter.update(frame)) {
          this.emitRepEvent(event);
        }
      }
    }, FRAME_MS);
  }

  stop(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  onFrame(cb: (frame: PoseFrame) => void): void {
    this.frameCallbacks.push(cb);
  }

  onRepEvent(cb: (event: RepEvent) => void): void {
    this.repEventCallbacks.push(cb);
  }

  setRange(range: PersonalRange): void {
    // Delegates entirely to the real hysteresis state machine
    // (lib/pose/repCounter.ts) instead of re-implementing threshold logic
    // here, so mock and real counting can never drift apart again —
    // including the degenerate-range guard (maxDeg <= minDeg never counts).
    this.repCounter = createRepCounter(range);
  }

  private visibilityFor(elapsedMs: number): number {
    const cycle = elapsedMs % 14_000;
    return cycle > 11_800 && cycle < 12_700 ? LOW_VISIBILITY : HIGH_VISIBILITY;
  }

  private emitFrame(frame: PoseFrame): void {
    for (const callback of this.frameCallbacks) {
      callback(frame);
    }
  }

  private emitRepEvent(event: RepEvent): void {
    for (const callback of this.repEventCallbacks) {
      callback(event);
    }
  }
}
