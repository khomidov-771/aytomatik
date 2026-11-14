"use client";

import { useEffect, useRef } from "react";
import { MessageCircle, Send } from "lucide-react";

type ParticleFlowProps = {
  accessibleLabel: string;
  commentLabel: string;
  keywordLabel: string;
  directLabel: string;
};

type Particle = {
  offset: number;
  speed: number;
  phase: number;
  spread: number;
  size: number;
  opacity: number;
};

function cubic(a: number, b: number, c: number, d: number, t: number) {
  const inverse = 1 - t;
  return inverse ** 3 * a + 3 * inverse ** 2 * t * b + 3 * inverse * t ** 2 * c + t ** 3 * d;
}

export function ParticleFlow({ accessibleLabel, commentLabel, keywordLabel, directLabel }: ParticleFlowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = canvas?.parentElement;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !surface || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particles: Particle[] = Array.from({ length: 168 }, (_, index) => ({
      offset: (index * 0.61803398875) % 1,
      speed: 0.035 + ((index * 17) % 29) / 250,
      phase: index * 2.3999632297,
      spread: ((index % 13) - 6) / 6,
      size: 0.65 + ((index * 7) % 10) / 10,
      opacity: 0.24 + ((index * 11) % 67) / 100,
    }));

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const resize = () => {
      const bounds = surface.getBoundingClientRect();
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.max(1, Math.floor(width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const bounds = surface.getBoundingClientRect();
      pointerX = (event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5;
      pointerY = (event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5;
    };

    const draw = (timestamp: number) => {
      const seconds = reducedMotion ? 0 : timestamp / 1000;
      context.clearRect(0, 0, width, height);
      context.save();
      context.translate(pointerX * -7, pointerY * -5);

      const startX = width * 0.12;
      const startY = height * 0.58;
      const controlOneX = width * 0.34;
      const controlOneY = height * 0.82;
      const controlTwoX = width * 0.62;
      const controlTwoY = height * 0.26;
      const endX = width * 0.88;
      const endY = height * 0.45;

      const trail = context.createLinearGradient(startX, startY, endX, endY);
      trail.addColorStop(0, "rgba(72, 227, 172, 0)");
      trail.addColorStop(0.28, "rgba(73, 226, 172, .48)");
      trail.addColorStop(0.72, "rgba(131, 255, 213, .82)");
      trail.addColorStop(1, "rgba(118, 255, 211, .08)");

      for (let line = -1; line <= 1; line += 1) {
        const branch = line * height * 0.085;
        context.beginPath();
        context.moveTo(startX, startY);
        context.bezierCurveTo(controlOneX, controlOneY + branch, controlTwoX, controlTwoY + branch, endX, endY);
        context.strokeStyle = trail;
        context.lineWidth = line === 0 ? 1.3 : 0.65;
        context.globalAlpha = line === 0 ? 0.56 : 0.22;
        context.shadowColor = "rgba(67, 236, 177, .38)";
        context.shadowBlur = line === 0 ? 16 : 9;
        context.stroke();
      }

      context.shadowBlur = 0;
      for (let index = 0; index < 54; index += 1) {
        const seed = index * 2.3999632297;
        const x = width * (0.2 + ((index * 37) % 79) / 100);
        const y = height * (0.2 + ((index * 23) % 66) / 100) + Math.sin(seconds * 0.35 + seed) * 2.2;
        const radius = index % 9 === 0 ? 1.2 : 0.55;
        context.globalAlpha = 0.14 + (Math.sin(seconds * 0.6 + seed) + 1) * 0.14;
        context.fillStyle = index % 7 === 0 ? "#f6c783" : "#9ef9d5";
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }

      for (const particle of particles) {
        const progress = (particle.offset + seconds * particle.speed) % 1;
        const envelope = Math.sin(progress * Math.PI);
        const x = cubic(startX, controlOneX, controlTwoX, endX, progress);
        const baseline = cubic(startY, controlOneY, controlTwoY, endY, progress);
        const oscillation = Math.sin(progress * Math.PI * 4 + particle.phase + seconds * 0.28);
        const y = baseline + particle.spread * envelope * height * 0.11 + oscillation * envelope * 4;
        const alpha = particle.opacity * (0.42 + (Math.sin(seconds * 1.3 + particle.phase) + 1) * 0.26);

        context.globalAlpha = alpha;
        context.fillStyle = particle.phase % 4 < 1 ? "#f4c47c" : "#8ff6cf";
        context.shadowColor = "rgba(78, 245, 188, .88)";
        context.shadowBlur = particle.size * 7;
        context.beginPath();
        context.arc(x, y, particle.size, 0, Math.PI * 2);
        context.fill();
      }

      context.restore();
      if (!reducedMotion) frame = window.requestAnimationFrame(draw);
    };

    resize();
    surface.addEventListener("pointermove", onPointerMove, { passive: true });
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    draw(0);
    if (!reducedMotion) frame = window.requestAnimationFrame(draw);

    return () => {
      surface.removeEventListener("pointermove", onPointerMove);
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div className="hero-visual" role="img" aria-label={accessibleLabel}>
    <canvas className="particle-canvas" ref={canvasRef} aria-hidden="true" />
    <div className="signal-node signal-comment" aria-hidden="true"><span className="signal-node-icon"><MessageCircle /></span><span>{commentLabel}</span><strong>Narxi qancha?</strong></div>
    <div className="signal-node signal-keyword" aria-hidden="true"><span>{keywordLabel}</span><strong>narx</strong></div>
    <div className="signal-node signal-direct" aria-hidden="true"><span className="signal-node-icon"><Send /></span><span>{directLabel}</span></div>
    <span className="signal-orbit signal-orbit-one" aria-hidden="true" />
    <span className="signal-orbit signal-orbit-two" aria-hidden="true" />
  </div>;
}
