export default function About() {
  return (
    <section className="band shell">
      <p className="eyebrow">About</p>
      <h1 className="display">How this group works</h1>

      <div className="prose" style={{ marginTop: 32 }}>
        <p className="lede" style={{ marginTop: 0 }}>
          Black Box is a six-person student research group with two mentors. We pick small problems we
          can fully understand, train the models ourselves, and write down what happened — including
          the runs that failed.
        </p>

        <h2>What we're studying</h2>
        <p>
          Generalisation. Specifically: the distance between what a model has memorised and what it
          has actually learned, measured on data it has never seen. Every project on this site is a
          different angle on that one question.
        </p>

        <h2>How a project gets published here</h2>
        <p>
          One member owns it, a second member reproduces the result from the notebook alone, and a
          mentor reviews the method before anything is written up. If the second run doesn't match
          the first, the project isn't finished — it's a bug report.
        </p>

        <h2>Stack</h2>
        <p>
          Python, NumPy and PyTorch for the models. React and Vite for this site. The network on the
          home page is a live canvas simulation of a forward pass, and the scatter plot below it runs
          a real least-squares fit in your browser — neither is a pre-rendered image.
        </p>

        <h2>Get in touch</h2>
        <p>
          We're happy to share notebooks, data, or a walkthrough. Write to{" "}
          <a href="mailto:hello@fitlab.example" style={{ color: "var(--signal)" }}>
            hello@fitlab.example
          </a>
          .
        </p>
      </div>
    </section>
  );
}
