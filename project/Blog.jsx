import { Link } from "react-router-dom";
import SplitText from "../components/SplitText";
import { Reveal } from "../components/Layout";
import { posts } from "../data/content";

export default function Blog() {
  return (
    <section className="band shell">
      <Reveal variant="fade">
        <p className="eyebrow">Blog</p>
      </Reveal>
      <SplitText as="h1" className="display" text="Things we only learned by getting them wrong" />
      <Reveal variant="fade" delay={260}>
        <p className="lede">
          Working notes from the group. Every post comes out of a run that actually happened — no
          conclusions we haven't tested.
        </p>
      </Reveal>

      <div style={{ marginTop: 52, borderTop: "1px solid var(--grid-strong)" }}>
        {posts.map((p, i) => (
          <Reveal key={p.slug} variant="rise" delay={i * 80}>
            <Link to={`/blog/${p.slug}`} className="post">
              <span className="post__meta">
                {p.date} · {p.author} · {p.read}
              </span>
              <h2 className="display post__title" style={{ fontSize: "1.7rem", margin: "8px 0 0" }}>
                {p.title}
              </h2>
              <p>{p.excerpt}</p>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
