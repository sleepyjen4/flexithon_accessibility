import { describe, expect, it } from "vitest";
import {
  isCommandInText,
  isVoiceControlSupported,
  parseVoiceCommand,
} from "@/lib/voice";

describe("parseVoiceCommand", () => {
  it("maps every grammar phrase to its command", () => {
    expect(parseVoiceCommand("start")).toBe("start");
    expect(parseVoiceCommand("begin")).toBe("start");
    expect(parseVoiceCommand("pause")).toBe("pause");
    expect(parseVoiceCommand("resume")).toBe("resume");
    expect(parseVoiceCommand("continue")).toBe("resume");
    expect(parseVoiceCommand("next")).toBe("next");
    expect(parseVoiceCommand("done")).toBe("next");
    expect(parseVoiceCommand("skip")).toBe("skip");
    expect(parseVoiceCommand("finish")).toBe("finish");
  });

  it("ignores case, punctuation, and surrounding whitespace", () => {
    expect(parseVoiceCommand("  Pause!  ")).toBe("pause");
    expect(parseVoiceCommand("NEXT.")).toBe("next");
  });

  it("finds a command inside a longer utterance", () => {
    expect(parseVoiceCommand("okay let's pause for a second")).toBe("pause");
  });

  it("uses the most recent command when the utterance contains several", () => {
    expect(parseVoiceCommand("pause no wait resume")).toBe("resume");
  });

  it("never matches partial words, so the app's own spoken cues can't echo-trigger commands", () => {
    // These are real cue strings spoken or announced on the exercise screen.
    expect(parseVoiceCommand("paused")).toBeNull();
    expect(parseVoiceCommand("tracking resumed")).toBeNull();
    expect(parseVoiceCommand("rep five counted")).toBeNull();
    expect(parseVoiceCommand("restart")).toBeNull();
    expect(parseVoiceCommand("the finisher")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(parseVoiceCommand("")).toBeNull();
    expect(parseVoiceCommand("raise your arm to a comfortable range")).toBeNull();
  });
});

describe("isCommandInText (echo guard)", () => {
  it("flags a command whose word appears in the app's own narration", () => {
    // The real rest cue: with the mic on, this coming out of the speakers
    // must not be treated as the user saying "next".
    const restCue = "Time to rest. Take your time — the next exercise waits for you.";
    expect(isCommandInText("next", restCue)).toBe(true);
    expect(isCommandInText("start", "Start with hands at shoulder height.")).toBe(true);
  });

  it("does not flag commands absent from the narration, so they work mid-speech", () => {
    const restCue = "Time to rest. Take your time — the next exercise waits for you.";
    expect(isCommandInText("skip", restCue)).toBe(false);
    expect(isCommandInText("pause", restCue)).toBe(false);
  });

  it("matches whole words only", () => {
    expect(isCommandInText("pause", "Paused with 0:30 left.")).toBe(false);
    expect(isCommandInText("start", "Return slowly to the start.")).toBe(true);
  });

  it("checks every synonym of the command", () => {
    // "done" is a synonym of "next" — narration containing it must flag too.
    expect(isCommandInText("next", "Well done today.")).toBe(true);
  });
});

describe("isVoiceControlSupported", () => {
  it("is false where SpeechRecognition does not exist (node, non-Chrome browsers)", () => {
    expect(isVoiceControlSupported()).toBe(false);
  });
});
