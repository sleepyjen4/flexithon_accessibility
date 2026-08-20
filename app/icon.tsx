import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/* Warm-paper palette, mirrored from the tokens in app/globals.css. Hex is
 * hardcoded on purpose: next/og renders through satori in an edge-ish runtime
 * with a limited CSS subset — no custom properties, no external fonts. */
const INK = "#211d19"; // --ink, the ground
const MILK = "#fff9ee"; // --milk on ink = 16:1
const RASPBERRY_BRIGHT = "#e8798f"; // --raspberry-bright, the on-dark raspberry

/* The "A" is drawn from three rounded bars rather than set in type: satori
 * only ships a regular-weight fallback face, so a text glyph renders thin and
 * washes out at favicon size. Building it keeps the stroke at ~10% of the
 * canvas, which survives being scaled down to 32px, and matches the heavy,
 * wide-tracked ALFA wordmark in the nav. */
const stroke = {
  position: "absolute" as const,
  background: MILK,
  borderRadius: 10,
};

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: INK,
        borderRadius: 96,
      }}
    >
      {/* left and right legs, splayed from a near-closed apex */}
      <div
        style={{
          ...stroke,
          left: 176,
          top: 84,
          width: 52,
          height: 280,
          transform: "rotate(15deg)",
        }}
      />
      <div
        style={{
          ...stroke,
          left: 284,
          top: 84,
          width: 52,
          height: 280,
          transform: "rotate(-15deg)",
        }}
      />
      {/* crossbar */}
      <div style={{ ...stroke, left: 180, top: 261, width: 152, height: 48 }} />
      {/* Decorative rule under the mark, echoing the wordmark's baseline.
       * Purely ornamental — the monogram carries the icon on its own. */}
      <div
        style={{
          position: "absolute",
          left: 168,
          top: 404,
          width: 176,
          height: 40,
          borderRadius: 999,
          background: RASPBERRY_BRIGHT,
        }}
      />
    </div>,
    size,
  );
}
