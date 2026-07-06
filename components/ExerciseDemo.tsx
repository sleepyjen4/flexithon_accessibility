"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { useProfileStore } from "@/store/profile";

interface ExerciseDemoProps {
  /** Base path (no extension) — .webm and .mp4 are appended. */
  videoUrl: string;
  name: string;
  className?: string;
  /** When false, omit the reduced-motion play button — used inside a card that
   * is itself a link (no nested interactive elements). Defaults to true. */
  interactive?: boolean;
}

/** F5 illustration: a short, muted, looping movement demo. It autoplays, but
 * respects reduced motion (the in-app setting OR the OS preference) — then it
 * stays paused on its first frame with a play control, so nothing moves until
 * the user asks (AGENTS §6 rule 6). object-contain keeps the square clip inside
 * a capped frame so it never pushes the timer/Done controls off-screen. */
export function ExerciseDemo({
  videoUrl,
  name,
  className = "",
  interactive = true,
}: ExerciseDemoProps) {
  const reducedPref = useProfileStore((state) => state.prefs.reduced_motion);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      const isReduced = reducedPref || media.matches;
      setReduced(isReduced);
      const video = videoRef.current;
      if (!video) return;
      if (isReduced) {
        video.pause();
      } else {
        // Muted playback is allowed without a user gesture.
        void video.play().catch(() => {});
      }
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [reducedPref]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-line bg-surface p-2 ${className}`}
    >
      <video
        ref={videoRef}
        className="mx-auto block max-h-45 rounded-xl sm:max-h-55 lg:max-h-65"
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={`${name} movement demonstration`}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src={`${videoUrl}.webm`} type="video/webm" />
        <source src={`${videoUrl}.mp4`} type="video/mp4" />
      </video>
      {interactive && reduced && !playing ? (
        <button
          type="button"
          onClick={() => void videoRef.current?.play().catch(() => {})}
          aria-label={`Play the ${name} demonstration`}
          className="absolute inset-0 flex items-center justify-center bg-ink/10 transition-colors hover:bg-ink/20"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-milk shadow-card">
            <Play aria-hidden="true" className="h-6 w-6" />
          </span>
        </button>
      ) : null}
    </div>
  );
}
