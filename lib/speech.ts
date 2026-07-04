import type { SpeakOptions } from "@/types";

interface SpeechRequest {
  text: string;
  resolve: () => void;
  settled: boolean;
}

let currentRequest: SpeechRequest | null = null;
const queuedRequests: SpeechRequest[] = [];
let pendingRepAnnouncement: ReturnType<typeof setTimeout> | null = null;

function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  return window.speechSynthesis;
}

/**
 * Speak a user-triggered workout update. Longer utterances queue normally;
 * live rep counts use `announceRepCount` so they never lag behind the UI.
 */
export function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return Promise.resolve();
  }

  const speechSynthesis = getSpeechSynthesis();

  if (!speechSynthesis) {
    return Promise.resolve();
  }

  if (options.interrupt) {
    settleRequest(currentRequest);
    settleQueuedRequests();
    currentRequest = null;
    speechSynthesis.cancel();
  }

  return new Promise((resolve) => {
    const request: SpeechRequest = {
      text: trimmedText,
      resolve,
      settled: false,
    };

    queuedRequests.push(request);
    processSpeechQueue();
  });
}

/**
 * Announce the latest rep count without letting speech fall behind the UI.
 * Fast reps coalesce into the newest count instead of queueing stale counts.
 */
export function announceRepCount(count: number): void {
  if (pendingRepAnnouncement) {
    clearTimeout(pendingRepAnnouncement);
  }

  pendingRepAnnouncement = setTimeout(() => {
    pendingRepAnnouncement = null;
    void speak(`Rep ${count}`, { interrupt: true });
  }, 160);
}

export function cancelSpeech(): void {
  if (pendingRepAnnouncement) {
    clearTimeout(pendingRepAnnouncement);
    pendingRepAnnouncement = null;
  }

  settleRequest(currentRequest);
  settleQueuedRequests();
  currentRequest = null;
  getSpeechSynthesis()?.cancel();
}

function processSpeechQueue(): void {
  if (currentRequest || queuedRequests.length === 0) {
    return;
  }

  const speechSynthesis = getSpeechSynthesis();

  if (!speechSynthesis) {
    settleQueuedRequests();
    return;
  }

  currentRequest = queuedRequests.shift() ?? null;

  if (!currentRequest) {
    return;
  }

  const request = currentRequest;
  const utterance = new SpeechSynthesisUtterance(request.text);
  utterance.rate = 0.92;
  utterance.pitch = 1;
  utterance.volume = 1;
  utterance.onend = () => finishRequest(request);
  utterance.onerror = () => finishRequest(request);

  speechSynthesis.speak(utterance);
}

function finishRequest(request: SpeechRequest): void {
  if (currentRequest !== request) {
    settleRequest(request);
    return;
  }

  currentRequest = null;
  settleRequest(request);
  processSpeechQueue();
}

function settleRequest(request: SpeechRequest | null): void {
  if (!request || request.settled) {
    return;
  }

  request.settled = true;
  request.resolve();
}

function settleQueuedRequests(): void {
  while (queuedRequests.length > 0) {
    settleRequest(queuedRequests.shift() ?? null);
  }
}
