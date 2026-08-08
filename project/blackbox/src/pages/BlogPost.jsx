import { Link, useParams } from "react-router-dom";
import { Reveal } from "../components/Layout";
import { posts } from "../data/content";

export default function BlogPost() {
  const { slug } = useParams();
  const i = posts.findIndex((x) => x.slug === slug);
  const p = posts[i];

  if (!p) {
    return (
      <section className="band shell">
        <p className="eyebrow">404</p>
        <h1 className="display">No post at that address</h1>
        <p className="lede">The link may be old. The full list is one click away.</p>
        <p style={{ marginTop: 24 }}>
          <Link to="/blog" className="back">← All posts</Link>
        </p>
      </section>
    );
  }

  const next = posts[(i + 1) % posts.length];

  return (
    <article className="band shell">
      <Link to="/blog" className="back">← All posts</Link>

      <header style={{ marginTop: 28, maxWidth: "20ch" }}>
        <span className="post__meta">
          {p.date} · {p.author} · {p.read}
        </span>
        <h1 className="display" style={{ marginTop: 12, fontSize: "clamp(2.2rem, 5vw, 3.6rem)" }}>
          {p.title}
        </h1>
      </header>

      <div className="prose" style={{ marginTop: 40 }}>
        {p.body.map((para, n) => (
          <Reveal key={n} variant="fade" delay={n * 60}>
            <p style={n === 0 ? { fontSize: "1.2rem", color: "var(--ink)" } : undefined}>{para}</p>
          </Reveal>
        ))}
      </div>

      <hr className="rule" style={{ margin: "56px 0 28px" }} />

      <Link to={`/blog/${next.slug}`} className="post" style={{ borderBottom: 0 }}>
        <span className="post__meta">Next post</span>
        <h2 className="display post__title" style={{ fontSize: "1.5rem", margin: "8px 0 0" }}>
          {next.title}
        </h2>
      </Link>
    </article>
  );
}
