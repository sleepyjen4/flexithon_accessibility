import type {
  PersonalRange,
  PoseFrame,
  PoseProvider,
  RepEvent,
} from "@/types";

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
  private range: PersonalRange | null = null;
  private count = 0;
  private aboveTarget = false;
  private rangeReachedForCurrentRep = false;
  private trackingPaused = false;

  start(): void {
    this.stop();
    this.count = 0;
    this.aboveTarget = false;
    this.rangeReachedForCurrentRep = false;
    this.trackingPaused = false;

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
      this.updateRepState(frame);
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
    this.range = range;
  }

  private visibilityFor(elapsedMs: number): number {
    const cycle = elapsedMs % 14_000;
    return cycle > 11_800 && cycle < 12_700 ? LOW_VISIBILITY : HIGH_VISIBILITY;
  }

  private updateRepState(frame: PoseFrame): void {
    if (!this.range) return;

    if (frame.visibility < 0.6) {
      if (!this.trackingPaused) {
        this.trackingPaused = true;
        this.emitRepEvent({ type: "tracking_paused" });
      }
      return;
    }

    if (this.trackingPaused) {
      this.trackingPaused = false;
      this.emitRepEvent({ type: "tracking_resumed" });
    }

    const targetDeg = this.range.maxDeg * 0.85;
    const downDeg = this.range.minDeg + (this.range.maxDeg - this.range.minDeg) * 0.15;

    if (!this.aboveTarget && frame.angleDeg >= targetDeg) {
      this.aboveTarget = true;
      if (!this.rangeReachedForCurrentRep) {
        this.rangeReachedForCurrentRep = true;
        this.emitRepEvent({ type: "range_reached" });
      }
      return;
    }

    if (this.aboveTarget && frame.angleDeg <= downDeg) {
      this.aboveTarget = false;
      this.rangeReachedForCurrentRep = false;
      this.count += 1;
      this.emitRepEvent({ type: "rep", count: this.count });
    }
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
