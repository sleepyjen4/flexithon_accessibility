import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS } from "@/store/profile";

// lib/speech.ts is a client module built on the Web Speech API and HTMLAudio,
// neither of which exists in the node test environment. We stub minimal fakes
// on globalThis before importing the module, and reset module state between
// tests (the module holds singletons: the speech queue, memoized voice, and the
// resolved voice-list promise) via vi.resetModules + a fresh dynamic import.

interface FakeVoice {
  name: string;
  lang: string;
}

class FakeUtterance {
  text: string;
  voice: FakeVoice | null = null;
  rate = 1;
  pitch = 1;
  volume = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

class FakeSynth {
  spoken: FakeUtterance[] = [];
  cancelCount = 0;
  private listeners: Record<string, Array<() => void>> = {};
  constructor(private voices: FakeVoice[]) {}
  getVoices(): FakeVoice[] {
    return this.voices;
  }
  addEventListener(type: string, cb: () => void): void {
    (this.listeners[type] ??= []).push(cb);
  }
  speak(utterance: FakeUtterance): void {
    this.spoken.push(utterance);
  }
  cancel(): void {
    this.cancelCount += 1;
  }
}

class FakeAudio {
  static created: FakeAudio[] = [];
  static playCalls = 0;
  // Simulate the browser autoplay policy blocking playback (Safari/iOS).
  static rejectPlay = false;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  paused = false;
  src: string;
  constructor(url: string) {
    this.src = url;
    FakeAudio.created.push(this);
  }
  play(): Promise<void> {
    FakeAudio.playCalls += 1;
    return FakeAudio.rejectPlay
      ? Promise.reject(new Error("autoplay blocked"))
      : Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
}

let synth: FakeSynth;

function makeLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

function installGlobals(voices: FakeVoice[]): void {
  synth = new FakeSynth(voices);
  FakeAudio.created = [];
  FakeAudio.playCalls = 0;
  FakeAudio.rejectPlay = false;
  // The profile store persists via localStorage, which node lacks.
  const localStorage = makeLocalStorage();
  (globalThis as Record<string, unknown>).localStorage = localStorage;
  (globalThis as Record<string, unknown>).window = {
    speechSynthesis: synth,
    Audio: FakeAudio,
    localStorage,
  };
  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance;
}

async function loadModule(voices: FakeVoice[] = [{ name: "Samantha", lang: "en-US" }]) {
  vi.resetModules();
  installGlobals(voices);
  const speech = await import("./speech");
  const { useProfileStore } = await import("@/store/profile");
  useProfileStore.setState({ prefs: { ...DEFAULT_PREFS } });
  return { speech, useProfileStore };
}

/** Flush the microtasks that ensureVoicesLoaded/speakRequest await, plus any
 * timers, without advancing wall-clock meaningfully. */
async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).localStorage;
  delete (globalThis as Record<string, unknown>).SpeechSynthesisUtterance;
});

describe("pickFemaleVoice", () => {
  it("prefers a named female voice over a generic 'female' match", async () => {
    const { speech } = await loadModule();
    const voices: FakeVoice[] = [
      { name: "Generic Female", lang: "en-US" },
      { name: "Samantha", lang: "en-US" },
    ];
    expect(speech.pickFemaleVoice(voices as never)?.name).toBe("Samantha");
  });

  it("respects hint priority order (samantha before karen)", async () => {
    const { speech } = await loadModule();
    const voices: FakeVoice[] = [
      { name: "Karen", lang: "en-AU" },
      { name: "Samantha", lang: "en-US" },
    ];
    expect(speech.pickFemaleVoice(voices as never)?.name).toBe("Samantha");
  });

  it("restricts to English voices when any exist", async () => {
    const { speech } = await loadModule();
    const voices: FakeVoice[] = [
      { name: "Amélie", lang: "fr-FR" }, // "moira"/"tessa" would never match here
      { name: "Karen", lang: "en-AU" },
    ];
    expect(speech.pickFemaleVoice(voices as never)?.name).toBe("Karen");
  });

  it("falls back to the first available voice when no female hint matches", async () => {
    const { speech } = await loadModule();
    const voices: FakeVoice[] = [
      { name: "Daniel", lang: "en-GB" },
      { name: "Alex", lang: "en-US" },
    ];
    expect(speech.pickFemaleVoice(voices as never)?.name).toBe("Daniel");
  });

  it("returns null when there are no voices at all", async () => {
    const { speech } = await loadModule();
    expect(speech.pickFemaleVoice([])).toBeNull();
  });
});

describe("speak queueing and interrupt", () => {
  it("speaks queued utterances in order, one at a time", async () => {
    const { speech } = await loadModule();
    void speech.speak("first");
    void speech.speak("second");
    await flush();

    // Only the first utterance is in flight; the second waits for its onend.
    expect(synth.spoken.map((u) => u.text)).toEqual(["first"]);

    synth.spoken[0].onend?.();
    await flush();
    expect(synth.spoken.map((u) => u.text)).toEqual(["first", "second"]);
  });

  it("applies the female voice and gentle rate to the utterance", async () => {
    const { speech } = await loadModule([{ name: "Victoria", lang: "en-US" }]);
    void speech.speak("hello");
    await flush();
    expect(synth.spoken[0].voice?.name).toBe("Victoria");
    expect(synth.spoken[0].rate).toBe(0.92);
  });

  it("interrupt cancels the in-flight utterance and resolves its promise", async () => {
    const { speech } = await loadModule();
    let firstResolved = false;
    void speech.speak("first").then(() => {
      firstResolved = true;
    });
    await flush();
    expect(synth.spoken.map((u) => u.text)).toEqual(["first"]);

    void speech.speak("second", { interrupt: true });
    await flush();

    expect(synth.cancelCount).toBe(1);
    expect(firstResolved).toBe(true);
    expect(synth.spoken.map((u) => u.text)).toEqual(["first", "second"]);
  });
});

describe("announceRepCount coalescing", () => {
  it("collapses a burst of rep counts into the latest one", async () => {
    const { speech } = await loadModule();
    speech.announceRepCount(1);
    speech.announceRepCount(2);
    speech.announceRepCount(3);

    await vi.advanceTimersByTimeAsync(160);
    expect(synth.spoken.map((u) => u.text)).toEqual(["Rep 3"]);
  });

  it("cancelSpeech clears a pending rep announcement so it never speaks", async () => {
    const { speech } = await loadModule();
    speech.announceRepCount(5);
    speech.cancelSpeech();

    await vi.advanceTimersByTimeAsync(200);
    expect(synth.spoken).toHaveLength(0);
  });
});

describe("muting via speech_enabled preference", () => {
  it("does not speak while speech is disabled", async () => {
    const { speech, useProfileStore } = await loadModule();
    useProfileStore.setState({ prefs: { ...DEFAULT_PREFS, speech_enabled: false } });

    await speech.speak("nope");
    await flush();
    expect(synth.spoken).toHaveLength(0);
  });

  it("cancels in-flight speech the moment speech is turned off", async () => {
    const { speech, useProfileStore } = await loadModule();
    void speech.speak("mid-sentence");
    await flush();
    expect(synth.spoken).toHaveLength(1);

    useProfileStore.setState({ prefs: { ...DEFAULT_PREFS, speech_enabled: false } });
    expect(synth.cancelCount).toBe(1);
  });
});

describe("speakOrPlay clip vs fallback", () => {
  it("plays the pre-generated clip when an audio url is given", async () => {
    const { speech } = await loadModule();
    void speech.speakOrPlay("/audio/seated_band_row.wav", "fallback text");
    await flush();

    expect(FakeAudio.created.map((a) => a.src)).toEqual(["/audio/seated_band_row.wav"]);
    expect(FakeAudio.playCalls).toBe(1);
    expect(synth.spoken).toHaveLength(0);
  });

  it("falls back to Web Speech when no clip url is available", async () => {
    const { speech } = await loadModule();
    void speech.speakOrPlay(null, "spoken fallback");
    await flush();

    expect(FakeAudio.created).toHaveLength(0);
    expect(synth.spoken.map((u) => u.text)).toEqual(["spoken fallback"]);
  });

  it("falls back to Web Speech when the clip's autoplay is blocked", async () => {
    const { speech } = await loadModule();
    FakeAudio.rejectPlay = true; // simulate Safari blocking autoplay
    void speech.speakOrPlay("/audio/seated_band_row.wav", "spoken fallback");
    await flush();

    // The clip was attempted, then handed off to Web Speech rather than silence.
    expect(FakeAudio.created).toHaveLength(1);
    expect(FakeAudio.playCalls).toBe(1);
    expect(synth.spoken.map((u) => u.text)).toEqual(["spoken fallback"]);
  });

  it("no-ops entirely while speech is disabled", async () => {
    const { speech, useProfileStore } = await loadModule();
    useProfileStore.setState({ prefs: { ...DEFAULT_PREFS, speech_enabled: false } });

    await speech.speakOrPlay("/audio/x.wav", "fallback");
    await flush();
    expect(FakeAudio.created).toHaveLength(0);
    expect(synth.spoken).toHaveLength(0);
  });
});
