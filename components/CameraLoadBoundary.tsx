"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
}

/** The camera tracker (F9) is loaded lazily with next/dynamic. A chunk-load
 * failure (stale hash after a deploy/rebuild, flaky network) or any runtime
 * error inside it must never take down the workout player — the camera is an
 * optional enhancement (AGENTS.md §5b), so we catch here and degrade to the
 * manual flow. Remounting (toggling the camera off/on) resets and retries. */
export class CameraLoadBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Camera tracker failed to load:", error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
