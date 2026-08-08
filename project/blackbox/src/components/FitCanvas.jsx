import { useEffect, useMemo, useRef, useState } from "react";
import { makeYData, polyfit, polyval, mse, REGIMES } from "../lib/fit";

const W = 620;
const H = 400;
const PAD = 26;
const SAMPLES = 140;

const sx = (x) => PAD + ((x + 1.15) / 2.5) * (W - PAD * 2);
const sy = (y) => H - PAD - ((y + 0.85) / 1.75) * (H - PAD * 2);

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export default function FitCanvas({ onRegimeChange }) {
  const { train, test } = useMemo(() => makeYData(), []);
  const reduced = useReducedMotion();
  const [active, setActive] = useState(1);
  const [pinned, setPinned] = useState(false);
  const [t, setT] = useState(0);
  const raf = useRef(0);

  const models = useMemo(() => {
    const xs = train.map((p) => p[0]);
    const ys = train.map((p) => p[1]);
    const txs = test.map((p) => p[0]);
    const tys = test.map((p) => p[1]);

    return REGIMES.map((r) => {
      const coeffs = polyfit(xs, ys, r.degree);
      const curve = Array.from({ length: SAMPLES }, (_, i) => {
        const x = -1.05 + (i / (SAMPLES - 1)) * 2.1;
        return [x, Math.max(-0.85, Math.min(0.9, polyval(coeffs, x)))];
      });
      return {
        ...r,
        curve,
        trainLoss: mse(coeffs, xs, ys),
        testLoss: mse(coeffs, txs, tys),
      };
    });
  }, [train, test]);

  // Cycle through the three regimes until the visitor takes over.
  useEffect(() => {
    if (pinned || reduced) return;
    const id = setInterval(() => setActive((a) => (a + 1) % models.length), 3600);
    return () => clearInterval(id);
  }, [pinned, reduced, models.length]);

  // Morph the curve between regimes instead of cutting.
  useEffect(() => {
    if (reduced) {
      setT(1);
      return;
    }
    const from = t;
    const start = performance.now();
    cancelAnimationFrame(raf.current);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 620);
      const eased = 1 - Math.pow(1 - p, 3);
      setT(from + (1 - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    setT(0);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduced]);

  const prev = models[(active - 1 + models.length) % models.length];
  const model = models[active];

  useEffect(() => {
    onRegimeChange?.(model);
  }, [model, onRegimeChange]);

  const path = useMemo(() => {
    const pts = model.curve.map(([x, y], i) => {
      const y0 = prev.curve[i][1];
      const yy = y0 + (y - y0) * t;
      return `${i === 0 ? "M" : "L"}${sx(x).toFixed(1)} ${sy(yy).toFixed(1)}`;
    });
    return pts.join(" ");
  }, [model, prev, t]);

  const pick = (i) => {
    setPinned(true);
    setActive(i);
  };

  return (
    <div>
      <div className="canvas">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`Scatter of Y-shaped data with a degree ${model.degree} polynomial fitted through it.`}
          style={{ display: "block" }}
        >
          <g stroke="var(--grid)" strokeWidth="1">
            {Array.from({ length: 9 }, (_, i) => {
              const x = PAD + (i * (W - PAD * 2)) / 8;
              return <line key={`v${i}`} x1={x} y1={PAD} x2={x} y2={H - PAD} />;
            })}
            {Array.from({ length: 6 }, (_, i) => {
              const y = PAD + (i * (H - PAD * 2)) / 5;
              return <line key={`h${i}`} x1={PAD} y1={y} x2={W - PAD} y2={y} />;
            })}
          </g>

          <g stroke="var(--muted)" strokeWidth="1" opacity="0.55">
            {train.map(([x, y], i) => (
              <g key={`tr${i}`} transform={`translate(${sx(x)} ${sy(y)})`}>
                <line x1="-3" y1="0" x2="3" y2="0" />
                <line x1="0" y1="-3" x2="0" y2="3" />
              </g>
            ))}
          </g>

          <g fill="none" stroke="var(--ink)" strokeWidth="1" opacity="0.4">
            {test.map(([x, y], i) => (
              <circle key={`te${i}`} cx={sx(x)} cy={sy(y)} r="3.2" />
            ))}
          </g>

          <path
            d={path}
            fill="none"
            stroke={model.pen}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <text
            x={W - PAD}
            y={PAD + 4}
            textAnchor="end"
            fill="var(--muted)"
            fontFamily="var(--mono)"
            fontSize="11"
          >
            degree {model.degree}
          </text>
        </svg>

        <div className="canvas__readout">
          <span>
            train loss <b>{model.trainLoss.toFixed(4)}</b>
          </span>
          <span>
            test loss{" "}
            <b style={{ color: model.id === "over" ? "var(--pen-over)" : undefined }}>
              {model.testLoss.toFixed(4)}
            </b>
          </span>
          <span>
            params <b>{model.degree + 1}</b>
          </span>
          <span>
            n <b>{train.length}</b> train / <b>{test.length}</b> test
          </span>
        </div>
      </div>

      <div className="pens">
        {models.map((m, i) => (
          <button
            key={m.id}
            className="pen"
            style={{ color: i === active ? m.pen : undefined }}
            aria-pressed={i === active}
            onClick={() => pick(i)}
          >
            <span className="pen__swatch" style={{ background: m.pen }} />
            {m.label}
          </button>
        ))}
      </div>

      <p className="mono" style={{ color: "var(--muted)", marginTop: 12 }}>
        {model.verdict}
      </p>
    </div>
  );
}
