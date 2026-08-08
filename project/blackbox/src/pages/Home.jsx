import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import ForwardPass from "../components/ForwardPass";
import FitCanvas from "../components/FitCanvas";
import SplitText from "../components/SplitText";
import Tile from "../components/Tile";
import { Reveal } from "../components/Layout";
import { projects, team, mentors } from "../data/content";

function Line({ children, i }) {
  return (
    <span className="line">
      <span className="line__inner" style={{ "--i": i }}>
        {children}
      </span>
    </span>
  );
}

export default function Home() {
  const [regime, setRegime] = useState({ label: "Good fit", pen: "var(--pen-fit)" });
  const onRegimeChange = useCallback((m) => setRegime(m), []);

  return (
    <>
      <section className="hero">
        <div className="hero__viz">
          <ForwardPass />
        </div>
        <div className="hero__scrim" aria-hidden="true" />

        <div className="shell hero__copy">
          <p className="eyebrow line__inner" style={{ "--i": 0 }}>
            Six members · two mentors · 2026
          </p>
          <h1 className="display" style={{ maxWidth: "13ch" }}>
            <Line i={1}>Every model is a</Line>
            <Line i={2}>
              <span style={{ color: "var(--signal)" }}>black box</span>
            </Line>
            <Line i={3}>until you open it.</Line>
          </h1>
          <p className="lede line__inner" style={{ "--i": 5, maxWidth: "42ch" }}>
            So we opened ours. We train models, break them on purpose, and publish the plots that show
            exactly where the learning went wrong.
          </p>
          <p className="line__inner" style={{ "--i": 6, marginTop: 30 }}>
            <Link to="/projects" className="pen" style={{ textDecoration: "none" }}>
              Read the projects →
            </Link>
          </p>
        </div>
      </section>

      <section className="band shell">
        <div className="split-grid">
          <div>
            <Reveal variant="fade">
              <p className="eyebrow">Flagship · running live</p>
            </Reveal>
            <SplitText as="h2" className="display" text="The moment a model stops learning" />
            <Reveal variant="fade" delay={220}>
              <p className="lede">
                This is our Y-shaped dataset, fitted in your browser right now — no pre-rendered
                image. Watch the curve go from too rigid, to right, to chasing noise. The readout is
                doing real least squares.
              </p>
            </Reveal>
            <Reveal variant="rise" delay={320}>
              <p className="mono" style={{ color: "var(--muted)", marginTop: 24 }}>
                Currently drawing:{" "}
                <span style={{ color: regime.pen }}>{regime.label.toLowerCase()}</span>
              </p>
            </Reveal>
          </div>

          <Reveal variant="scale" delay={160}>
            <FitCanvas onRegimeChange={onRegimeChange} />
          </Reveal>
        </div>
      </section>

      <hr className="rule" />

      <section className="band shell">
        <Reveal variant="fade">
          <p className="eyebrow">The work</p>
        </Reveal>
        <SplitText as="h2" className="display" text="Three projects, one habit" />
        <Reveal variant="fade" delay={200}>
          <p className="lede">
            Plot the training loss and the test loss together, or don't plot anything. Each project
            below ends where the two curves disagree.
          </p>
        </Reveal>

        <div className="grid-3" style={{ marginTop: 40 }}>
          {projects.map((p, i) => (
            <Tile key={p.slug} p={p} delay={i * 110} />
          ))}
        </div>
      </section>

      <hr className="rule" />

      <section className="band--tight band shell">
        <Reveal variant="wipe">
          <p className="eyebrow">Who runs it</p>
        </Reveal>
        <Reveal variant="rise" delay={120}>
          <p className="lede" style={{ maxWidth: "70ch", color: "var(--ink)" }}>
            {team.map((m) => m.name.split(" ")[0]).join(", ")} — guided by {mentors[0].name} and{" "}
            {mentors[1].name}.{" "}
            <Link to="/team" style={{ color: "var(--signal)" }}>
              What each of us works on →
            </Link>
          </p>
        </Reveal>
      </section>
    </>
  );
}
