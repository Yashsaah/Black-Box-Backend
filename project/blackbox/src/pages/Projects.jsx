import { useState } from "react";
import SplitText from "../components/SplitText";
import Tile from "../components/Tile";
import { Reveal } from "../components/Layout";
import { projects } from "../data/content";

const tags = ["All", ...new Set(projects.map((p) => p.tag))];

export default function Projects() {
  const [tag, setTag] = useState("All");
  const shown = tag === "All" ? projects : projects.filter((p) => p.tag === tag);

  return (
    <section className="band shell">
      <Reveal variant="fade">
        <p className="eyebrow">Projects</p>
      </Reveal>
      <SplitText as="h1" className="display" text="What we built, and where it broke" />
      <Reveal variant="fade" delay={220}>
        <p className="lede">
          Each entry has the method, the numbers, the plots, and an honest paragraph about the failure
          mode. Filter by area.
        </p>
      </Reveal>

      <Reveal variant="rise" delay={300}>
        <div className="pens" style={{ marginTop: 32 }}>
          {tags.map((t) => (
            <button key={t} className="pen" aria-pressed={t === tag} onClick={() => setTag(t)}>
              {t}
            </button>
          ))}
        </div>
      </Reveal>

      <div className="grid-3" style={{ marginTop: 32 }}>
        {shown.map((p, i) => (
          <Tile key={p.slug} p={p} delay={i * 100} />
        ))}
      </div>
    </section>
  );
}
