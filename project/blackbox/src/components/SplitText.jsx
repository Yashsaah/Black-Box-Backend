import useInView from "../lib/useInView";

// Headings assemble word by word, each rising from behind its own baseline.
export default function SplitText({ text, as: Tag = "h2", className = "", delay = 0, step = 55 }) {
  const [ref, inView] = useInView({ threshold: 0.35 });
  const words = text.split(" ");

  return (
    <Tag ref={ref} className={`split ${className}`} aria-label={text}>
      {words.map((w, i) => (
        <span className="split__word" key={`${w}-${i}`} aria-hidden="true">
          <span
            className="split__inner"
            style={{
              transitionDelay: `${delay + i * step}ms`,
              transform: inView ? "none" : "translateY(110%)",
            }}
          >
            {w}
          </span>
        </span>
      ))}
    </Tag>
  );
}
