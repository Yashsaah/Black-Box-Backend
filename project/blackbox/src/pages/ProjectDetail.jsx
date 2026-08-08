import { Link, useParams } from "react-router-dom";
import Plot from "../components/Plot";
import { Reveal } from "../components/Layout";
import { projects } from "../data/content";

export default function ProjectDetail() {
  const { slug } = useParams();
  const p = projects.find((x) => x.slug === slug);

  if (!p) {
    return (
      <section className="band shell">
        <p className="eyebrow">404</p>
        <h1 className="display">No project at that address</h1>
        <p className="lede">The link may be old. The full list is one click away.</p>
        <p style={{ marginTop: 24 }}>
          <Link to="/projects" className="back">← All projects</Link>
        </p>
      </section>
    );
  }

  return (
    <article className="band shell">
      <Link to="/projects" className="back">← All projects</Link>

      <header style={{ marginTop: 28, maxWidth: "24ch" }}>
        <span className="tag" style={{ "--pen": p.pen }}>{p.tag}</span>
        <h1 className="display" style={{ marginTop: 12 }}>{p.title}</h1>
      </header>
      <p className="lede">{p.summary}</p>

      <dl className="spec" style={{ marginTop: 40 }}>
        {p.spec.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <div>
          <dt>Lead</dt>
          <dd>{p.lead}</dd>
        </div>
        <div>
          <dt>Period</dt>
          <dd>{p.period}</dd>
        </div>
      </dl>

      <Reveal variant="fade">
        <figure className="figure">
          <Plot curves={p.curves} />
          <figcaption>{p.curves.caption}</figcaption>
        </figure>
      </Reveal>

      <div className="prose">
        {p.sections.map((s, i) => (
          <Reveal key={s.heading} variant="rise" delay={i * 60}>
            <section>
              <h2>{s.heading}</h2>
              <p>{s.body}</p>
            </section>
          </Reveal>
        ))}
      </div>
    </article>
  );
}
