/**
 * Captures screenshots of every static app route and (with --pr) attaches them
 * to the current pull request as a single, self-updating comment.
 *
 * Images are committed to the orphan `pr-screenshots` branch and linked from
 * the comment by raw.githubusercontent URL pinned to the commit — GitHub has
 * no API for uploading an image to a comment, and this repo is public, so the
 * raw URLs render inline. Nothing is ever merged into main from that branch.
 *
 * Usage:  npm run screenshots                        (capture to .screenshots/)
 *         npm run screenshots:pr                     (capture + attach to the PR)
 *         npm run screenshots -- --only=/,/progress  (just those routes)
 *         npm run screenshots -- --fresh             (no seeded demo data — empty states)
 *         npm run screenshots -- --url=http://localhost:3000
 *
 * Reuses a dev server already listening on :3000; otherwise starts one and
 * shuts it down afterwards. Excluded from the app tsconfig; run with tsx.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer";
import type {
  Abilities,
  AccessibilityPrefs,
  EnergyLevel,
  WorkoutSessionSummary,
} from "../types";

const OUT_DIR = path.join(process.cwd(), ".screenshots");
const SCREENSHOT_BRANCH = "pr-screenshots";
const COMMENT_MARKER = "<!-- pr-screenshots -->";
/** AGENTS.md Section 7: the app is built mobile-first at 390px. */
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2 };
const DEFAULT_PORT = 3000;
/** Guards against a runaway viewport on very long pages (the exercise library). */
const MAX_CAPTURE_HEIGHT = 12_000;

// ---------------------------------------------------------------------------
// Route discovery
// ---------------------------------------------------------------------------

/**
 * Derives the capturable routes from the App Router tree so new screens are
 * picked up without editing this script. Dynamic segments are skipped: they
 * need a real id, which only the author of that PR knows (pass --only=... for
 * one). Route groups are stripped because they never appear in the URL.
 */
async function discoverRoutes(): Promise<string[]> {
  const appDir = path.join(process.cwd(), "app");
  const entries = await readdir(appDir, { recursive: true });

  const routes = entries
    .filter((entry) => path.basename(entry) === "page.tsx")
    .map((entry) => path.dirname(entry).split(path.sep))
    .filter((segments) => !segments.some((s) => s.includes("[") || s.startsWith("@")))
    .map((segments) =>
      segments
        .filter((s) => s !== "." && !(s.startsWith("(") && s.endsWith(")")))
        .join("/"),
    )
    .map((route) => `/${route}`.replace(/\/$/, "") || "/");

  return [...new Set(routes)].sort((a, b) =>
    a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b),
  );
}

function slugFor(route: string): string {
  return route === "/" ? "home" : route.slice(1).replace(/\//g, "-");
}

// ---------------------------------------------------------------------------
// Seeded demo state
// ---------------------------------------------------------------------------

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

/**
 * Mirrors what a returning user's browser holds, so the dashboard and progress
 * screens show real content instead of their empty states. Keys and shapes are
 * zustand-persist's (`store/*.ts`); the types keep them honest. Pass --fresh to
 * capture the empty states instead.
 */
function demoState(): Record<string, unknown> {
  const abilities: Abilities = {
    positions: ["seated"],
    equipment: ["resistance_band", "chair", "none"],
    avoid_regions: ["lower_back"],
    sensory: { captions: true, reduced_motion: false, haptics: false },
  };
  const prefs: AccessibilityPrefs = {
    text_size: "normal",
    high_contrast: false,
    reduced_motion: false,
    haptics: false,
    speech_enabled: true,
  };
  const sessions: WorkoutSessionSummary[] = [1, 3, 6].map((days, index) => ({
    id: `demo-session-${index}`,
    workout_title: ["Gentle Seated Strength", "Steady Upper Body", "Gentle Reset"][index],
    energy_level: ([3, 4, 2] as const)[index],
    completed_steps: [4, 5, 3][index],
    total_steps: [4, 5, 4][index],
    effort: [3, 4, 2][index],
    peak_rom_degrees: { seated_arm_raise: [82, 88, 74][index] },
    completed_at: daysAgo(days),
  }));

  return {
    "af-profile": {
      state: { displayName: "Sam", abilities, prefs, todaysEnergy: 3 as EnergyLevel },
      version: 0,
    },
    "af-history": {
      state: {
        sessions,
        checkins: [1, 2, 3, 5, 6].map((days) => ({
          energy: ((days % 4) + 2) as EnergyLevel,
          date: daysAgo(days).slice(0, 10),
        })),
      },
      version: 0,
    },
    "af-calibration": {
      state: {
        ranges: {
          seated_arm_raise: { minDeg: 14, maxDeg: 92, capturedAt: daysAgo(6) },
        },
      },
      version: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Dev server
// ---------------------------------------------------------------------------

async function isServing(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(url: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Dev server exited (code ${child.exitCode}) before serving ${url}.`);
    }
    if (await isServing(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Dev server did not respond at ${url} within 120s.`);
}

/** Asks the OS for an unused port so a stale dev server never blocks a run. */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, () => {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

/** Returns the base URL plus a cleanup that stops a server we started. */
async function resolveServer(
  explicitUrl: string | undefined,
): Promise<{ baseUrl: string; stop: () => void }> {
  if (explicitUrl) return { baseUrl: explicitUrl, stop: () => {} };

  const existing = `http://localhost:${DEFAULT_PORT}`;
  if (await isServing(existing)) {
    console.log(`Using the dev server already on ${existing}`);
    return { baseUrl: existing, stop: () => {} };
  }

  const port = await freePort();
  const baseUrl = `http://localhost:${port}`;
  console.log(`Starting a dev server on ${baseUrl}`);
  // Own process group: `npm run dev` forks `next dev`, and killing only the npm
  // wrapper would leave the real server listening after this script exits.
  const child = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
    stdio: ["ignore", "ignore", "inherit"],
    detached: true,
  });
  await waitForServer(baseUrl, child);
  return {
    baseUrl,
    stop: () => {
      if (child.pid !== undefined) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          // Already gone.
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

/**
 * Grows the viewport to the full page height so the capture needs no scrolling.
 * A `fullPage` capture stitches scroll strips, so the fixed bottom nav gets
 * baked in wherever the viewport happened to be — sitting on top of the
 * content. A tall viewport renders it once, at the bottom, where it belongs.
 * Two passes because `min-h-screen` grows with the viewport it is measured in.
 *
 * Returns false if the page is taller than the cap, so the caller falls back to
 * a stitched `fullPage` capture rather than silently cropping the page.
 */
async function growViewportToPage(page: Page): Promise<boolean> {
  let height = VIEWPORT.height;
  for (let pass = 0; pass < 2; pass += 1) {
    const measured = await page.evaluate(() => document.documentElement.scrollHeight);
    if (measured > MAX_CAPTURE_HEIGHT) return false;
    if (measured <= height) return true;
    height = measured;
    await page.setViewport({ ...VIEWPORT, height, isMobile: true, hasTouch: true });
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return true;
}

async function capture(
  page: Page,
  baseUrl: string,
  route: string,
): Promise<{ route: string; file: string }> {
  // Reset from whatever height the previous route grew to, so this page lays
  // out at the real mobile viewport before it is measured.
  await page.setViewport({ ...VIEWPORT, isMobile: true, hasTouch: true });
  await page.goto(`${baseUrl}${route}`, {
    waitUntil: "networkidle2",
    timeout: 60_000,
  });
  // Fonts and client hydration settle after networkidle; without this the
  // display face swaps in mid-screenshot.
  await page.evaluate(() => document.fonts.ready);
  await new Promise((resolve) => setTimeout(resolve, 500));
  // Next's dev-mode indicator is chrome, not the app.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important }" });
  const fits = await growViewportToPage(page);

  const file = path.join(OUT_DIR, `${slugFor(route)}.png`);
  await page.screenshot({ path: file as `${string}.png`, fullPage: !fits });
  console.log(`  ${route} → ${path.relative(process.cwd(), file)}`);
  return { route, file };
}

async function captureAll(
  baseUrl: string,
  routes: string[],
  seed: boolean,
): Promise<{ route: string; file: string }[]> {
  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({
      // A fake camera lets the tracking screens render their real UI instead of
      // a permission prompt; no hardware is touched. --no-sandbox keeps this
      // working under WSL and containers; the browser only ever loads localhost
      // pages from this repo.
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-video-capture",
        "--no-sandbox",
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ ...VIEWPORT, isMobile: true, hasTouch: true });
    // Freezes transitions so captures are stable — and exercises the app's own
    // prefers-reduced-motion gating (AGENTS.md Section 6.6).
    await page.emulateMediaFeatures([
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);
    if (seed) {
      const state = demoState();
      await page.evaluateOnNewDocument((entries: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(entries)) {
          localStorage.setItem(key, JSON.stringify(value));
        }
      }, state);
    }

    const shots: { route: string; file: string }[] = [];
    for (const route of routes) {
      shots.push(await capture(page, baseUrl, route));
    }
    return shots;
  } finally {
    await browser?.close();
  }
}

// ---------------------------------------------------------------------------
// GitHub: commit the images, then upsert one PR comment
// ---------------------------------------------------------------------------

function gh(args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8" }).trim();
}

async function ghApi<T>(
  token: string,
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = (text ? JSON.parse(text) : {}) as T;
  if (!response.ok && response.status !== 404) {
    throw new Error(`GitHub ${method} ${endpoint} → ${response.status}: ${text.slice(0, 300)}`);
  }
  return { status: response.status, data };
}

/** Commits every screenshot to the orphan branch in one commit, returning its sha. */
async function commitScreenshots(
  token: string,
  repo: string,
  prNumber: number,
  shots: { route: string; file: string }[],
): Promise<string> {
  const tree = await Promise.all(
    shots.map(async ({ route, file }) => {
      const content = (await readFile(file)).toString("base64");
      const blob = await ghApi<{ sha: string }>(token, "POST", `/repos/${repo}/git/blobs`, {
        content,
        encoding: "base64",
      });
      return {
        path: `pr-${prNumber}/${slugFor(route)}.png`,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.data.sha,
      };
    }),
  );

  const ref = await ghApi<{ object?: { sha: string } }>(
    token,
    "GET",
    `/repos/${repo}/git/ref/heads/${SCREENSHOT_BRANCH}`,
  );
  const parentSha = ref.status === 404 ? undefined : ref.data.object?.sha;

  let baseTree: string | undefined;
  if (parentSha) {
    const parent = await ghApi<{ tree: { sha: string } }>(
      token,
      "GET",
      `/repos/${repo}/git/commits/${parentSha}`,
    );
    baseTree = parent.data.tree.sha;
  }

  const created = await ghApi<{ sha: string }>(token, "POST", `/repos/${repo}/git/trees`, {
    ...(baseTree ? { base_tree: baseTree } : {}),
    tree,
  });
  const commit = await ghApi<{ sha: string }>(token, "POST", `/repos/${repo}/git/commits`, {
    message: `screenshots: PR #${prNumber}`,
    tree: created.data.sha,
    parents: parentSha ? [parentSha] : [],
  });

  if (parentSha) {
    await ghApi(token, "PATCH", `/repos/${repo}/git/refs/heads/${SCREENSHOT_BRANCH}`, {
      sha: commit.data.sha,
    });
  } else {
    console.log(`Creating the orphan \`${SCREENSHOT_BRANCH}\` branch to host the images`);
    await ghApi(token, "POST", `/repos/${repo}/git/refs`, {
      ref: `refs/heads/${SCREENSHOT_BRANCH}`,
      sha: commit.data.sha,
    });
  }

  return commit.data.sha;
}

function commentBody(
  repo: string,
  commitSha: string,
  prNumber: number,
  shots: { route: string }[],
): string {
  const cells = shots.map(({ route }) => {
    const url = `https://raw.githubusercontent.com/${repo}/${commitSha}/pr-${prNumber}/${slugFor(route)}.png`;
    return `<td align="center" width="50%"><code>${route}</code><br><img src="${url}" width="300" alt="The ${route} screen at 390px wide"></td>`;
  });

  const rows: string[] = [];
  for (let index = 0; index < cells.length; index += 2) {
    rows.push(`<tr>${cells.slice(index, index + 2).join("")}</tr>`);
  }

  return [
    COMMENT_MARKER,
    `### Screenshots — ${VIEWPORT.width}×${VIEWPORT.height} mobile`,
    "",
    `<table>${rows.join("")}</table>`,
    "",
    `<sub>Captured with \`npm run screenshots:pr\` · ${new Date().toISOString()} · reduced-motion on.`,
    " Not an accessibility sign-off — the axe + VoiceOver pass in the checklist above still applies.</sub>",
  ].join("\n");
}

async function attachToPr(shots: { route: string; file: string }[]): Promise<void> {
  const token = gh(["auth", "token"]);
  const repo = gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);

  let prNumber: number;
  try {
    prNumber = Number(gh(["pr", "view", "--json", "number", "-q", ".number"]));
  } catch {
    throw new Error(
      "No pull request found for the current branch. Open one first, then re-run.",
    );
  }

  const commitSha = await commitScreenshots(token, repo, prNumber, shots);
  const body = commentBody(repo, commitSha, prNumber, shots);

  const existing = await ghApi<{ id: number; body: string }[]>(
    token,
    "GET",
    `/repos/${repo}/issues/${prNumber}/comments?per_page=100`,
  );
  const previous = (Array.isArray(existing.data) ? existing.data : []).find((comment) => comment.body?.includes(COMMENT_MARKER));

  const result = previous
    ? await ghApi<{ html_url: string }>(
        token,
        "PATCH",
        `/repos/${repo}/issues/comments/${previous.id}`,
        { body },
      )
    : await ghApi<{ html_url: string }>(
        token,
        "POST",
        `/repos/${repo}/issues/${prNumber}/comments`,
        { body },
      );

  console.log(`${previous ? "Updated" : "Posted"} the screenshot comment on PR #${prNumber}`);
  console.log(result.data.html_url);
}

// ---------------------------------------------------------------------------

function flagValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const only = flagValue("only");
  const routes = only
    ? only.split(",").map((route) => route.trim()).filter(Boolean)
    : await discoverRoutes();

  if (routes.length === 0) {
    console.error("No routes to capture.");
    process.exitCode = 1;
    return;
  }

  const { baseUrl, stop } = await resolveServer(flagValue("url"));
  try {
    await rm(OUT_DIR, { recursive: true, force: true });
    await mkdir(OUT_DIR, { recursive: true });
    console.log(`Capturing ${routes.length} route(s) at ${VIEWPORT.width}px:`);
    const shots = await captureAll(baseUrl, routes, !process.argv.includes("--fresh"));

    if (process.argv.includes("--pr")) {
      await attachToPr(shots);
    } else {
      console.log(`done — ${shots.length} image(s) in ${path.relative(process.cwd(), OUT_DIR)}`);
    }
  } finally {
    stop();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
