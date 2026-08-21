/**
 * Design tokens for drawing surfaces that cannot use Tailwind classes.
 *
 * Canvas 2D takes plain colour strings — `context.fillStyle = "var(--marigold)"`
 * is simply ignored — so canvas code has always re-typed the token hexes by
 * hand (AGENTS.md Section 6, "token debt in canvas/SVG code"). That left the
 * camera stage blind to the F7 high-contrast setting, which works by
 * redefining the custom properties on `<html>`: class-based colour follows
 * along through `var()`, a hardcoded hex cannot.
 *
 * This resolves the tokens once from the computed style of the document root
 * and caches the result. The cache is dropped whenever `data-contrast` changes
 * on `<html>` (written by `applyPrefsToDocument` in `lib/prefs.ts`), so
 * toggling contrast takes effect on the next drawn frame rather than on
 * reload.
 *
 * Never call `getComputedStyle` from inside a draw loop directly: these
 * canvases redraw on every tracked frame, and forcing a style recalculation
 * per frame is a real cost on the phones this app targets. Call
 * `getCanvasPalette()` instead — after the first resolve it is a plain object
 * read.
 */

export interface CanvasPalette {
  /** `--marigold` — landmark dots on the dark camera stage. */
  marigold: string;
  /** `--raspberry-bright` — the tracked skeleton while landmarks are visible. */
  raspberryBright: string;
  /** `--stage-dim` — the same skeleton while visibility is too low to count. */
  stageDim: string;
}

/**
 * Used on the server, and in any environment where the stylesheet has not
 * applied yet, so drawing never silently falls back to transparent or black.
 * These mirror the `:root` values in `app/globals.css`; they are stale
 * defaults, not a second source of truth.
 */
const FALLBACK_PALETTE: CanvasPalette = {
  marigold: "#e5a83c",
  raspberryBright: "#e8798f",
  stageDim: "#8a7d66",
};

let cachedPalette: CanvasPalette | null = null;
let contrastObserver: MutationObserver | null = null;

function watchForTokenChanges(): void {
  if (contrastObserver || typeof MutationObserver === "undefined") return;

  // Only `data-contrast` redefines colour tokens today; `data-text-size` and
  // `data-reduced-motion` do not. This is a module-level singleton that lives
  // as long as the page and costs nothing until the attribute actually
  // changes, so there is nothing to tear down.
  contrastObserver = new MutationObserver(() => {
    cachedPalette = null;
  });
  contrastObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-contrast"],
  });
}

/**
 * The current token colours, as concrete CSS colour strings canvas can use.
 *
 * Safe during SSR: `document` is only touched inside this call, never at
 * module scope, and the server path returns the fallbacks without caching.
 */
export function getCanvasPalette(): CanvasPalette {
  if (typeof document === "undefined") return FALLBACK_PALETTE;
  if (cachedPalette) return cachedPalette;

  // One computed-style read for all three tokens.
  const styles = getComputedStyle(document.documentElement);
  const marigold = styles.getPropertyValue("--marigold").trim();
  const raspberryBright = styles.getPropertyValue("--raspberry-bright").trim();
  const stageDim = styles.getPropertyValue("--stage-dim").trim();

  const resolved: CanvasPalette = {
    marigold: marigold || FALLBACK_PALETTE.marigold,
    raspberryBright: raspberryBright || FALLBACK_PALETTE.raspberryBright,
    stageDim: stageDim || FALLBACK_PALETTE.stageDim,
  };

  // Nothing resolved at all means the stylesheet has not applied yet. Serve
  // the fallbacks but leave the cache empty, so a later frame picks up the
  // real tokens instead of pinning the defaults for the life of the page.
  if (!marigold && !raspberryBright && !stageDim) return resolved;

  cachedPalette = resolved;
  watchForTokenChanges();
  return cachedPalette;
}
