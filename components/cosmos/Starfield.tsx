"use client";

import { useEffect, useRef } from "react";

const TAU = Math.PI * 2;
const STAR_COUNT = 420;
const TINTS = ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#cdbcff", "#bfe3ff", "#ffe7c2"];

/** Small seeded generator: the background sky is the same on every visit. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Twinkling background stars, drawn on a full-screen canvas. */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const random = seeded(20261114);
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: random(),
      y: random(),
      radius: 0.35 + random() ** 4 * 1.5,
      base: 0.2 + random() * 0.6,
      speed: 0.25 + random() * 1.3,
      phase: random() * TAU,
      tint: TINTS[Math.floor(random() * TINTS.length)],
    }));

    let width = 0;
    let height = 0;
    let frame = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (time: number) => {
      const seconds = time / 1000;
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        context.globalAlpha = star.base * (0.62 + 0.38 * Math.sin(seconds * star.speed + star.phase));
        context.fillStyle = star.tint;
        context.beginPath();
        context.arc(star.x * width, star.y * height, star.radius, 0, TAU);
        context.fill();
      }
      frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}
