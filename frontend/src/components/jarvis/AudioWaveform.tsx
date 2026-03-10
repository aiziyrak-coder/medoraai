/**
 * AudioWaveform — Real-time ovoz to'lqini vizualizatsiyasi
 * Canvas asosida ishlaydi, requestAnimationFrame loop.
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { getWaveformData } from '../../services/speechService';

interface Props {
  analyser:  AnalyserNode | null;
  isActive:  boolean;
  color?:    string;   // bar rangi
  height?:   number;
  barCount?: number;
}

export const AudioWaveform: React.FC<Props> = ({
  analyser,
  isActive,
  color    = '#38bdf8',
  height   = 64,
  barCount = 40,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height: h } = canvas;
    ctx.clearRect(0, 0, width, h);

    if (!analyser || !isActive) {
      // Idle: flat line animation
      ctx.strokeStyle = color + '44';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      for (let x = 0; x < width; x++) {
        const y = h / 2 + Math.sin(x * 0.05 + Date.now() * 0.002) * 3;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    // Live frequency bars
    const data     = getWaveformData(analyser);
    const step     = Math.floor(data.length / barCount);
    const barWidth = (width / barCount) - 2;

    for (let i = 0; i < barCount; i++) {
      const idx     = i * step;
      const val     = data[idx] / 255;
      const barH    = Math.max(4, val * h * 0.9);
      const x       = i * (barWidth + 2);
      const y       = (h - barH) / 2;

      // Gradient bar
      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0,   color + 'cc');
      grad.addColorStop(0.5, color);
      grad.addColorStop(1,   color + 'cc');
      ctx.fillStyle   = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, 3);
      ctx.fill();
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [analyser, isActive, color, barCount]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={height}
      className="w-full rounded-xl"
      style={{ height }}
    />
  );
};
