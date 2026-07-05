// Transcodes exercise demo GIFs in public/graphics/ to web video (MP4 H.264 +
// WebM VP9), downscaled from the 1080² source to 720² — far smaller than the
// GIFs (~10×) and, unlike a GIF, pausable so we can honour reduced-motion.
//
// Usage:
//   node scripts/generate-exercise-video.mjs                 # all *.gif
//   node scripts/generate-exercise-video.mjs seated_lateral_raise [...ids]
//
// ffmpeg comes from the transient `ffmpeg-static` package (never a runtime dep,
// mirrors the build-time audio pipeline in AGENTS §5c). The .gif originals are
// left in place.
import { execFileSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");

const GRAPHICS_DIR = path.resolve("public/graphics");
const SCALE = "scale=720:-2:flags=lanczos"; // width 720, height auto (even)

const args = process.argv.slice(2);
const names = (
  args.length > 0
    ? args.map((a) => a.replace(/\.gif$/, ""))
    : readdirSync(GRAPHICS_DIR)
        .filter((f) => f.endsWith(".gif"))
        .map((f) => f.replace(/\.gif$/, ""))
).sort();

function run(label, ffmpegArgs) {
  process.stdout.write(`  ${label} … `);
  execFileSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...ffmpegArgs]);
  console.log("done");
}

let converted = 0;
for (const name of names) {
  const gif = path.join(GRAPHICS_DIR, `${name}.gif`);
  if (!existsSync(gif)) {
    console.warn(`! ${name}.gif not found — skipping`);
    continue;
  }
  console.log(`${name}.gif`);
  run("mp4 ", [
    "-i", gif,
    "-vf", SCALE,
    "-an",
    "-c:v", "libx264",
    "-crf", "28",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    path.join(GRAPHICS_DIR, `${name}.mp4`),
  ]);
  run("webm", [
    "-i", gif,
    "-vf", SCALE,
    "-an",
    "-c:v", "libvpx-vp9",
    "-crf", "34",
    "-b:v", "0",
    path.join(GRAPHICS_DIR, `${name}.webm`),
  ]);
  converted += 1;
}

console.log(`\nConverted ${converted} clip(s).`);
