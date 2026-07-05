import { describe, expect, it } from "vitest";
import {
  COMMAND_COOLDOWN_MS,
  createVoiceCommandMatcher,
  isCommandInText,
  isVoiceControlSupported,
  parseVoiceCommand,
} from "@/lib/voice";
import type { VoiceCommand } from "@/types";

const ALL_COMMANDS: readonly VoiceCommand[] = [
  "start",
  "pause",
  "resume",
  "next",
  "skip",
  "finish",
];

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

  it("maps curated sound-alike mistranscriptions to their command", () => {
    expect(parseVoiceCommand("paws")).toBe("pause");
    expect(parseVoiceCommand("stop")).toBe("pause");
    expect(parseVoiceCommand("ship")).toBe("skip");
    expect(parseVoiceCommand("text")).toBe("next");
    expect(parseVoiceCommand("necks")).toBe("next");
    expect(parseVoiceCommand("star")).toBe("start");
    expect(parseVoiceCommand("Finnish")).toBe("finish");
    expect(parseVoiceCommand("finished")).toBe("finish");
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
    // "stop" matches "pause", so AI adaptation notes like this must flag it.
    expect(isCommandInText("pause", "Stop if you feel shoulder pain.")).toBe(
      true,
    );
  });
});

describe("createVoiceCommandMatcher", () => {
  it("dispatches an allowed command and ignores commands outside the allowed list", () => {
    const matcher = createVoiceCommandMatcher();
    expect(matcher.match(0, ["pause"], ALL_COMMANDS)).toBe("pause");
    expect(matcher.match(1, ["finish"], ["pause", "next"])).toBeNull();
    expect(matcher.isConsumed(1)).toBe(false);
  });

  it("finds a command in a later alternative when the top guess is garbled", () => {
    const matcher = createVoiceCommandMatcher();
    expect(matcher.match(0, ["nick's", "next", "nix"], ALL_COMMANDS)).toBe(
      "next",
    );
  });

  it("dispatches once per result index (interim result, then its final)", () => {
    let time = 0;
    const matcher = createVoiceCommandMatcher({ now: () => time });
    expect(matcher.match(0, ["skip"], ALL_COMMANDS)).toBe("skip");
    time += COMMAND_COOLDOWN_MS + 1; // isolate the index dedupe from cooldown
    expect(matcher.match(0, ["skip"], ALL_COMMANDS)).toBeNull();
    expect(matcher.isConsumed(0)).toBe(true);
  });

  it("applies a per-command cooldown across result indexes and session resets", () => {
    let time = 0;
    const matcher = createVoiceCommandMatcher({ now: () => time });
    expect(matcher.match(0, ["next"], ALL_COMMANDS)).toBe("next");
    time += 200;
    expect(matcher.match(1, ["next"], ALL_COMMANDS)).toBeNull();
    matcher.reset(); // session restart must not defeat the cooldown
    time += 200;
    expect(matcher.match(0, ["next"], ALL_COMMANDS)).toBeNull();
    time += COMMAND_COOLDOWN_MS;
    expect(matcher.match(1, ["next"], ALL_COMMANDS)).toBe("next");
  });

  it("suppresses a command echoed from the app's own narration, and keeps it suppressed when the final result lands after narration ends", () => {
    let spoken: string | null =
      "Time to rest. Take your time — the next exercise waits for you.";
    const matcher = createVoiceCommandMatcher({ getSpokenText: () => spoken });
    // Interim result arrives while the rest cue is playing.
    expect(matcher.match(0, ["next"], ALL_COMMANDS)).toBeNull();
    expect(matcher.isConsumed(0)).toBe(true);
    // Narration finished before the final result for the same utterance.
    spoken = null;
    expect(matcher.match(0, ["next"], ALL_COMMANDS)).toBeNull();
    // A genuinely new utterance still works.
    expect(matcher.match(1, ["next"], ALL_COMMANDS)).toBe("next");
  });

  it("lets commands absent from the narration through mid-speech", () => {
    const matcher = createVoiceCommandMatcher({
      getSpokenText: () => "the next exercise waits for you",
    });
    expect(matcher.match(0, ["skip"], ALL_COMMANDS)).toBe("skip");
  });

  it("reset clears index dedupe for the new session's numbering", () => {
    let time = 0;
    const matcher = createVoiceCommandMatcher({ now: () => time });
    expect(matcher.match(0, ["pause"], ALL_COMMANDS)).toBe("pause");
    matcher.reset();
    time += COMMAND_COOLDOWN_MS + 1;
    expect(matcher.match(0, ["resume"], ALL_COMMANDS)).toBe("resume");
  });
});

describe("isVoiceControlSupported", () => {
  it("is false where SpeechRecognition does not exist (node, non-Chrome browsers)", () => {
    expect(isVoiceControlSupported()).toBe(false);
  });
});
