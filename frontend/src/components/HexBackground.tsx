/**
 * HexBackground — To'g'ri ari uyali (honeycomb) + kichik elektron zarrachalar
 * Pointy-top hexagon geometriyasi, elektronlar kichik va kam
 */
import React, { useEffect, useRef } from 'react';

const R   = 34;          // hexagon radius
const EL  = 12;          // elektron soni (kam)
const TRL = 16;          // trail uzunligi

interface V2 { x: number; y: number }
interface El {
    x: number; y: number;
    vx: number; vy: number;
    hue: number;
    trail: V2[];
    phase: number;
}

/* Pointy-top hexagon vertices */
function hexVerts(cx: number, cy: number, r: number): V2[] {
    return Array.from({ length: 6 }, (_, i) => {
        const a = Math.PI / 180 * (60 * i + 30);   // +30 = pointy-top
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });
}

function newEl(W: number, H: number): El {
    const spd = 0.3 + Math.random() * 0.5;
    const ang = Math.random() * Math.PI * 2;
    return {
        x: Math.random() * W, y: Math.random() * H,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        hue: 170 + Math.random() * 60,
        trail: [],
        phase: Math.random() * Math.PI * 2,
    };
}

const HexBackground: React.FC = () => {
    const ref = useRef<HTMLCanvasElement>(null);
    const raf = useRef(0);

    useEffect(() => {
        const cv  = ref.current; if (!cv) return;
        const ctx = cv.getContext('2d'); if (!ctx) return;

        let W = 0, H = 0, frame = 0;
        const els: El[] = [];

        function resize() {
            W = cv!.width  = window.innerWidth;
            H = cv!.height = window.innerHeight;
            els.length = 0;
            for (let i = 0; i < EL; i++) els.push(newEl(W, H));
        }

        /* ─── Honeycomb (pointy-top) ─── */
        function drawHex() {
            // Pointy-top hexagon grid
            const colW = R * Math.sqrt(3);   // horizontal step
            const rowH = R * 1.5;            // vertical step

            const cols = Math.ceil(W / colW) + 2;
            const rows = Math.ceil(H / rowH) + 2;

            ctx!.save();
            // Pulse opacity very slightly
            const pulse = 0.14 + Math.sin(frame * 0.006) * 0.02;
            ctx!.strokeStyle = `rgba(56,185,210,${pulse})`;
            ctx!.lineWidth   = 0.85;

            ctx!.beginPath();
            for (let col = -1; col < cols; col++) {
                for (let row = -1; row < rows; row++) {
                    // Offset odd columns
                    const cx = col * colW + (row % 2 !== 0 ? colW / 2 : 0);
                    const cy = row * rowH;
                    const v  = hexVerts(cx, cy, R);

                    ctx!.moveTo(v[0].x, v[0].y);
                    for (let i = 1; i < 6; i++) ctx!.lineTo(v[i].x, v[i].y);
                    ctx!.closePath();
                }
            }
            ctx!.stroke();
            ctx!.restore();
        }

        /* ─── Electrons ─── */
        function drawEls() {
            for (const e of els) {
                const pts = e.trail;
                if (pts.length < 2) continue;

                // Trail
                ctx!.save();
                ctx!.lineCap  = 'round';
                for (let i = 1; i < pts.length; i++) {
                    const f = 1 - i / pts.length;
                    ctx!.beginPath();
                    ctx!.moveTo(pts[i-1].x, pts[i-1].y);
                    ctx!.lineTo(pts[i].x, pts[i].y);
                    ctx!.strokeStyle = `hsla(${e.hue},85%,60%,${f * f * 0.6})`;
                    ctx!.lineWidth   = f * 1.4;
                    ctx!.stroke();
                }
                ctx!.restore();

                // Head glow (small)
                const g = ctx!.createRadialGradient(e.x, e.y, 0, e.x, e.y, 5);
                g.addColorStop(0,   `hsla(${e.hue},90%,75%,0.85)`);
                g.addColorStop(0.5, `hsla(${e.hue},85%,65%,0.35)`);
                g.addColorStop(1,   `hsla(${e.hue},85%,65%,0)`);
                ctx!.save();
                ctx!.fillStyle   = g;
                ctx!.shadowColor = `hsla(${e.hue},90%,70%,0.7)`;
                ctx!.shadowBlur  = 6;
                ctx!.beginPath();
                ctx!.arc(e.x, e.y, 5, 0, Math.PI * 2);
                ctx!.fill();
                ctx!.restore();

                // Core dot — very small
                ctx!.save();
                ctx!.fillStyle   = `hsla(${e.hue},100%,85%,0.9)`;
                ctx!.shadowColor = `hsla(${e.hue},100%,75%,0.9)`;
                ctx!.shadowBlur  = 5;
                ctx!.beginPath();
                ctx!.arc(e.x, e.y, 1.2, 0, Math.PI * 2);
                ctx!.fill();
                ctx!.restore();
            }
        }

        /* ─── Update ─── */
        function update() {
            for (const e of els) {
                e.phase += 0.04;

                // Gentle random steering
                if (Math.random() < 0.015) {
                    const a = Math.random() * Math.PI * 2;
                    const s = Math.hypot(e.vx, e.vy);
                    e.vx = e.vx * 0.8 + Math.cos(a) * s * 0.2;
                    e.vy = e.vy * 0.8 + Math.sin(a) * s * 0.2;
                }

                // Speed clamp
                const s = Math.hypot(e.vx, e.vy);
                const max = 0.85, min = 0.25;
                if (s > max) { e.vx = e.vx/s*max; e.vy = e.vy/s*max; }
                if (s < min) { const a = Math.random()*Math.PI*2; e.vx=Math.cos(a)*min; e.vy=Math.sin(a)*min; }

                e.x += e.vx; e.y += e.vy;

                // Bounce
                if (e.x < 0)  { e.x=0;  e.vx= Math.abs(e.vx); }
                if (e.x > W)  { e.x=W;  e.vx=-Math.abs(e.vx); }
                if (e.y < 0)  { e.y=0;  e.vy= Math.abs(e.vy); }
                if (e.y > H)  { e.y=H;  e.vy=-Math.abs(e.vy); }

                e.trail.unshift({ x:e.x, y:e.y });
                if (e.trail.length > TRL) e.trail.length = TRL;
            }
        }

        function tick() {
            frame++;
            ctx!.clearRect(0, 0, W, H);
            drawHex();
            drawEls();
            update();
            raf.current = requestAnimationFrame(tick);
        }

        window.addEventListener('resize', resize);
        resize();
        raf.current = requestAnimationFrame(tick);
        return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf.current); };
    }, []);

    return (
        <canvas
            ref={ref}
            style={{
                position: 'fixed', inset: 0,
                width: '100%', height: '100%',
                zIndex: 0, pointerEvents: 'none',
            }}
            aria-hidden="true"
        />
    );
};

export default HexBackground;
