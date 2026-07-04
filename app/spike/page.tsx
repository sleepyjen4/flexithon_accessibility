"use client";

import { useEffect, useRef, useState } from "react";
import type {
  PoseLandmarker as PoseLandmarkerType,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";

const UPPER_BODY_INDICES = [11, 12, 13, 14, 15, 16, 23, 24] as const;

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export default function SpikePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fps, setFps] = useState(0);
  const [status, setStatus] = useState("Loading...");
  const [delegate, setDelegate] = useState<"GPU" | "CPU" | null>(null);

  useEffect(() => {
    let animationId: number;
    let poseLandmarker: PoseLandmarkerType | null = null;
    let frameCount = 0;
    let fpsUpdateTime = performance.now();
    let stream: MediaStream | null = null;

    async function setup() {
      const { PoseLandmarker, FilesetResolver } = await import(
        "@mediapipe/tasks-vision"
      );

      setStatus("Loading model...");

      // Type is inferred here, so we never need to name/import WasmFileset directly.
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      // Try GPU first (faster); fall back to CPU if it fails to init
      // (common on older/integrated graphics laptops).
      try {
        poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        setDelegate("GPU");
      } catch (gpuErr) {
        console.warn("GPU delegate failed, falling back to CPU:", gpuErr);
        poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        setDelegate("CPU");
      }

      setStatus("Requesting camera...");

      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus("Tracking (upper body)");
      predictWebcam();
    }

    function predictWebcam() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !poseLandmarker) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const result = poseLandmarker.detectForVideo(video, performance.now());
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      result.landmarks?.forEach((landmarks: NormalizedLandmark[]) => {
        UPPER_BODY_INDICES.forEach((i) => {
          const point = landmarks[i];
          if (!point) return;
          ctx.beginPath();
          ctx.arc(point.x * canvas.width, point.y * canvas.height, 5, 0, 2 * Math.PI);
          ctx.fillStyle = "#00ff88";
          ctx.fill();
        });
      });

      frameCount++;
      const now = performance.now();
      if (now - fpsUpdateTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        fpsUpdateTime = now;
      }

      animationId = requestAnimationFrame(predictWebcam);
    }

    setup().catch((err) => {
      console.error(err);
      setStatus("Error: " + (err instanceof Error ? err.message : String(err)));
    });

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      stream?.getTracks().forEach((track) => track.stop());
      poseLandmarker?.close();
    };
  }, []);

  return (
    <div>
      <p style={{ margin: "8px 0", fontFamily: "monospace" }}>
        Status: {status} | FPS: {fps} | Delegate: {delegate ?? "—"}
      </p>
      <div style={{ position: "relative", width: 640, height: 480 }}>
        <video
          ref={videoRef}
          style={{ position: "absolute", top: 0, left: 0, transform: "scaleX(-1)" }}
          width={640}
          height={480}
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", top: 0, left: 0, transform: "scaleX(-1)" }}
        />
      </div>
    </div>
  );
}