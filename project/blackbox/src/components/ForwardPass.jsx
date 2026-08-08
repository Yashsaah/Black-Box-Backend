import { useEffect, useRef } from "react";

const LAYERS = [4, 7, 7, 3];
const CYCLE = 5200; // ms for one full pass, input to output

const hex = (h) => {
  const s = h.replace("#", "").trim();
  const n = parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t) => t * t * (3 - 2 * t);

export default function ForwardPass() {
  const wrap = useRef(null);
  const cv = useRef(null);

  useEffect(() => {
    const canvas = cv.current;
    const box = wrap.current;
    if (!canvas || !box) return;
    const ctx = canvas.getContext("2d");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const css = getComputedStyle(document.documentElement);
    const SIGNAL = hex(css.getPropertyValue("--signal") || "#ff6b4a");
    const DIM = hex(css.getPropertyValue("--muted") || "#878c94");

    let w = 0;
    let h = 0;
    let nodes = [];
    let edges = [];
    let raf = 0;
    let cycle = -1;

    const build = () => {
      const r = box.getBoundingClientRect();
      w = r.width;
      h = r.height;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const padX = w * 0.16;
      const padY = h * 0.14;
      nodes = LAYERS.map((count, l) => {
        const x = padX + (l / (LAYERS.length - 1)) * (w - padX * 2);
        return Array.from({ length: count }, (_, i) => ({
          x,
          y: count === 1 ? h / 2 : padY + (i / (count - 1)) * (h - padY * 2),
          a: 0.4,
        }));
      });

      if (!edges.length) {
        for (let l = 0; l < LAYERS.length - 1; l++) {
          for (let i = 0; i < LAYERS[l]; i++) {
            for (let j = 0; j < LAYERS[l + 1]; j++) {
              edges.push({
                l,
                i,
                j,
                w: Math.random() * 2 - 1,
                off: Math.random(),
              });
            }
          }
        }
      }
    };

    // Fresh activations every pass, so no two cycles look the same.
    const reroll = () => {
      nodes.forEach((layer) =>
        layer.forEach((n) => {
          n.a = 0.22 + Math.random() * 0.78;
        })
      );
    };

    const frame = (now) => {
      if (!w || !h) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const p = calm ? 0.55 : (now % CYCLE) / CYCLE;
      const c = Math.floor(now / CYCLE);
      if (c !== cycle) {
        cycle = c;
        reroll();
      }

      ctx.clearRect(0, 0, w, h);

      // resting connections
      ctx.lineWidth = 1;
      for (const e of edges) {
        const a = nodes[e.l][e.i];
        const b = nodes[e.l + 1][e.j];
        ctx.strokeStyle = rgba(DIM, 0.05 + Math.abs(e.w) * 0.05);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // signal travelling along the strong weights, layer by layer
      const fade = 1 - clamp01((p - 0.86) / 0.14);
      ctx.lineCap = "round";
      for (const e of edges) {
        const mag = Math.abs(e.w);
        if (mag < 0.3) continue;
        const start = 0.06 + e.l * 0.2;
        const q = clamp01((p - start) / 0.26);
        if (q <= 0 || q >= 1) continue;
        const qe = clamp01((q - e.off * 0.3) / 0.7);
        if (qe <= 0 || qe >= 1) continue;

        const a = nodes[e.l][e.i];
        const b = nodes[e.l + 1][e.j];
        const tail = clamp01(qe - 0.16);
        const lerp = (t) => [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t];
        const [x1, y1] = lerp(tail);
        const [x2, y2] = lerp(qe);

        ctx.strokeStyle = rgba(SIGNAL, mag * 0.85 * fade);
        ctx.lineWidth = 1 + mag * 0.9;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // neurons: halo scales with activation once the wave reaches them
      for (let l = 0; l < nodes.length; l++) {
        const arrive = 0.02 + l * 0.2;
        const lit = ease(clamp01((p - arrive) / 0.07)) * fade;
        for (const n of nodes[l]) {
          const b = lit * n.a;
          if (b > 0.04) {
            const R = 8 + 30 * b;
            const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, R);
            g.addColorStop(0, rgba(SIGNAL, 0.34 * b));
            g.addColorStop(1, rgba(SIGNAL, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(n.x, n.y, R, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = b > 0.05 ? rgba(SIGNAL, 0.5 + b * 0.5) : rgba(DIM, 0.55);
          ctx.beginPath();
          ctx.arc(n.x, n.y, 2.4 + 3.6 * b, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (calm) return;
      raf = requestAnimationFrame(frame);
    };

    build();
    reroll();
    raf = requestAnimationFrame(frame);

    const ro = new ResizeObserver(build);
    ro.observe(box);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="fp" ref={wrap}>
      <canvas ref={cv} aria-hidden="true" />
      <span className="fp__corner fp__corner--tl" aria-hidden="true" />
      <span className="fp__corner fp__corner--tr" aria-hidden="true" />
      <span className="fp__corner fp__corner--bl" aria-hidden="true" />
      <span className="fp__corner fp__corner--br" aria-hidden="true" />
      <span className="fp__tag mono">
        <i className="fp__blink" aria-hidden="true" />
        Forward pass · live
      </span>
      <span className="fp__arch mono">{LAYERS.join(" · ")}</span>
      <span className="sr">
        An animated diagram of a {LAYERS.join("-")} neural network with signal travelling from the
        input layer to the output layer.
      </span>
    </div>
  );
}
