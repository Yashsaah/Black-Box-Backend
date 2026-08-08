import SplitText from "../components/SplitText";
import { Reveal } from "../components/Layout";
import { Link } from "react-router-dom";
import { team, mentors } from "../data/content";

const initials = (n) => n.split(" ").map((w) => w[0]).join("");

function Person({ p, delay }) {
  return (
    <Reveal variant="rise" delay={delay} style={{ height: "100%" }}>
      <div className="person" style={{ height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="person__initials" aria-hidden="true">{initials(p.name)}</span>
          <span>
            <h3 className="display" style={{ fontSize: "1.1rem" }}>{p.name}</h3>
            <span className="person__role">{p.role}</span>
          </span>
        </div>
        <p>{p.focus}</p>
        <a
          className="mono"
          href={`mailto:${p.email}`}
          style={{ color: "var(--signal)", textDecoration: "none", display: "inline-block", marginTop: 14 }}
        >
          {p.email}
        </a>
      </div>
    </Reveal>
  );
}

export default function Team() {
  return (
    <section className="band shell">
      <Reveal variant="fade">
        <p className="eyebrow">Team</p>
      </Reveal>
      <SplitText as="h1" className="display" text="Six of us, and two people who ask harder questions" />
      <Reveal variant="fade" delay={260}>
        <p className="lede">
          Everyone owns a project end to end and reviews someone else's. The mentors read every result
          before it lands on this site. Full contact details are on the{" "}
          <Link to="/contact" style={{ color: "var(--signal)" }}>contact page</Link>.
        </p>
      </Reveal>

      <div className="grid-3" style={{ marginTop: 44 }}>
        {team.map((p, i) => <Person key={p.name} p={p} delay={i * 80} />)}
      </div>

      <Reveal variant="wipe">
        <p className="eyebrow" style={{ marginTop: 64 }}>Mentors</p>
      </Reveal>
      <div className="grid-3">
        {mentors.map((p, i) => <Person key={p.name} p={p} delay={i * 80} />)}
      </div>
    </section>
  );
}
