import SplitText from "../components/SplitText";
import { Reveal } from "../components/Layout";
import { team, mentors, contact } from "../data/content";

function Row({ p, delay }) {
  return (
    <Reveal variant="rise" delay={delay}>
      <div className="row">
        <span>
          <span className="row__name">{p.name}</span>
          <span className="row__role">{p.role} · {p.focus.split(",")[0]}</span>
        </span>
        <a href={`mailto:${p.email}`}>{p.email}</a>
        <a href={`https://github.com/${p.github}`} target="_blank" rel="noreferrer">
          github.com/{p.github}
        </a>
      </div>
    </Reveal>
  );
}

export default function Contact() {
  return (
    <section className="band shell">
      <Reveal variant="fade">
        <p className="eyebrow">Contact</p>
      </Reveal>
      <SplitText as="h1" className="display" text="Ask us anything about the work" />
      <Reveal variant="fade" delay={240}>
        <p className="lede">
          Notebooks, datasets, a walkthrough of any result on this site — just ask. Reach the whole
          group at once, or go direct to whoever owns the project.
        </p>
      </Reveal>

      <Reveal variant="rise" delay={320}>
        <div className="contact-lead">
          <a href={`mailto:${contact.email}`}>✉ {contact.email}</a>
          <a href={`https://github.com/${contact.github}`} target="_blank" rel="noreferrer">
            ↗ github.com/{contact.github}
          </a>
        </div>
      </Reveal>

      <Reveal variant="fade">
        <p className="eyebrow" style={{ marginTop: 72 }}>The team</p>
      </Reveal>
      <div className="rows">
        {team.map((p, i) => (
          <Row key={p.name} p={p} delay={i * 60} />
        ))}
      </div>

      <Reveal variant="fade">
        <p className="eyebrow" style={{ marginTop: 64 }}>Mentors</p>
      </Reveal>
      <div className="rows">
        {mentors.map((p, i) => (
          <Row key={p.name} p={p} delay={i * 60} />
        ))}
      </div>
    </section>
  );
}
