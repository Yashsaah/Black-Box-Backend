import useInView from "../lib/useInView";

const W = 640;
const H = 300;
const PAD = { l: 46, r: 20, t: 20, b: 34 };

export default function Plot({ curves }) {
  const [ref, inView] = useInView({ threshold: 0.3 });

  const all = curves.series.flatMap((s) => s.points);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const n = curves.series[0].points.length;

  const px = (i) => PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r);
  const py = (v) => H - PAD.b - ((v - min) / span) * (H - PAD.t - PAD.b);

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={curves.caption} style={{ display: "block" }}>
      <g stroke="var(--grid)" strokeWidth="1">
        {Array.from({ length: 5 }, (_, i) => {
          const y = PAD.t + (i * (H - PAD.t - PAD.b)) / 4;
          return <line key={i} x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} />;
        })}
      </g>

      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--grid-strong)" />
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--grid-strong)" />

      {curves.series.map((s, si) => (
        <path
          key={s.name}
          d={s.points.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(" ")}
          fill="none"
          stroke={s.color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={s.dashed ? "5 5" : 1}
          pathLength={s.dashed ? undefined : 1}
          style={
            s.dashed
              ? { opacity: inView ? 1 : 0, transition: `opacity 1s ease ${600 + si * 200}ms` }
              : {
                  strokeDashoffset: inView ? 0 : 1,
                  transition: `stroke-dashoffset 1.7s cubic-bezier(.45,0,.15,1) ${si * 220}ms`,
                }
          }
        />
      ))}

      {curves.series.map((s, si) => (
        <g key={`${s.name}-pts`} fill={s.color}>
          {s.points.map((v, i) => (
            <circle
              key={i}
              cx={px(i)}
              cy={py(v)}
              r="2.4"
              style={{
                opacity: inView ? 1 : 0,
                transition: `opacity .35s ease ${si * 220 + (i / n) * 1500 + 200}ms`,
              }}
            />
          ))}
        </g>
      ))}

      {curves.series.map((s, i) => (
        <text
          key={`${s.name}-label`}
          x={W - PAD.r}
          y={PAD.t + 4 + i * 16}
          textAnchor="end"
          fill={s.color}
          fontFamily="var(--mono)"
          fontSize="11"
          style={{ opacity: inView ? 1 : 0, transition: "opacity .6s ease 1.4s" }}
        >
          {s.name}
        </text>
      ))}

      {curves.ticks.map((t, i) =>
        t ? (
          <text
            key={i}
            x={PAD.l + (i * (W - PAD.l - PAD.r)) / (curves.ticks.length - 1)}
            y={H - PAD.b + 18}
            textAnchor="middle"
            fill="var(--muted)"
            fontFamily="var(--mono)"
            fontSize="11"
          >
            {t}
          </text>
        ) : null
      )}

      <text x={W - PAD.r} y={H - 4} textAnchor="end" fill="var(--muted)" fontFamily="var(--mono)" fontSize="11">
        {curves.xLabel}
      </text>
      <text x={PAD.l - 8} y={PAD.t + 4} textAnchor="end" fill="var(--muted)" fontFamily="var(--mono)" fontSize="11">
        {max.toFixed(2)}
      </text>
      <text x={PAD.l - 8} y={H - PAD.b} textAnchor="end" fill="var(--muted)" fontFamily="var(--mono)" fontSize="11">
        {min.toFixed(2)}
      </text>
    </svg>
  );
}
