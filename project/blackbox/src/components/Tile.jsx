import { useRef } from "react";
import { Link } from "react-router-dom";
import useInView from "../lib/useInView";

// A project tile that leans toward the pen and bleeds its own ink underneath.
export default function Tile({ p, delay = 0 }) {
  const box = useRef(null);
  const [ref, inView] = useInView({ threshold: 0.15 });

  const move = (e) => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-py * 5).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(px * 5).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${e.clientX - r.left}px`);
    el.style.setProperty("--gy", `${e.clientY - r.top}px`);
  };

  const reset = () => {
    const el = box.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <div ref={ref} className={`r r--rise ${inView ? "is-in" : ""}`} style={{ "--d": `${delay}ms`, height: "100%" }}>
      <Link
        ref={box}
        to={`/projects/${p.slug}`}
        className="tile"
        style={{ "--pen": p.pen }}
        onPointerMove={move}
        onPointerLeave={reset}
      >
        <span className="tag" style={{ "--pen": p.pen }}>
          {p.tag}
        </span>
        <h3 className="display" style={{ marginTop: 10 }}>
          {p.title}
        </h3>
        <p>{p.summary}</p>
        <span className="tile__meta">
          <span>{p.period}</span>
          <span className="tile__go">Lead: {p.lead}</span>
        </span>
      </Link>
    </div>
  );
}
