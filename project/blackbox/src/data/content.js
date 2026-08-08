// Everything on the site reads from here. Add a project object and it appears
// on the home page, the index, and gets its own route automatically.

export const projects = [
  {
    slug: "y-shaped-fit",
    title: "Where a model stops learning and starts memorising",
    tag: "Regression",
    pen: "var(--pen-fit)",
    summary:
      "We fitted polynomials of rising degree to a Y-shaped point cloud and watched the moment training loss and test loss part ways.",
    period: "Mar–Apr 2026",
    lead: "Yash",
    spec: [
      ["Data", "86 points, Y-shaped"],
      ["Models", "Degree 1 → 13"],
      ["Split", "75 / 25"],
      ["Loss", "MSE"],
    ],
    sections: [
      {
        heading: "What we were asking",
        body: "A model that fits every training point perfectly is usually worse than one that doesn't. We wanted to see that claim rather than read it, so we built a dataset with a shape no straight line could ever capture — a stem that forks into two branches — and fitted polynomials of increasing degree to it.",
      },
      {
        heading: "What happened",
        body: "Degree 1 flattens the whole structure into a slope. Around degree 4 the curve tracks the stem and splits the difference between the branches, which is the best an honest single-valued function can do. Past degree 10 the curve starts bending toward individual points. Training loss keeps falling. Test loss turns around and climbs.",
      },
      {
        heading: "What we took from it",
        body: "The gap between the two loss curves is the useful signal, not either curve alone. We now plot both by default in every experiment the group runs, and we treat a widening gap as a stop condition rather than something to explain away later.",
      },
    ],
    curves: {
      caption: "Training loss keeps falling. Test loss turns at degree 6.",
      xLabel: "polynomial degree",
      series: [
        {
          name: "train",
          color: "var(--pen-fit)",
          points: [0.061, 0.048, 0.041, 0.037, 0.034, 0.031, 0.028, 0.024, 0.019, 0.013, 0.008],
        },
        {
          name: "test",
          color: "var(--pen-over)",
          points: [0.066, 0.055, 0.047, 0.043, 0.041, 0.04, 0.044, 0.053, 0.069, 0.094, 0.128],
        },
      ],
      ticks: ["1", "3", "5", "7", "9", "11"],
    },
  },
  {
    slug: "cnn-digits",
    title: "A CNN that reads handwriting, and the filters it invented",
    tag: "Computer vision",
    pen: "var(--pen-over)",
    summary:
      "Three convolution blocks trained from scratch. We pulled the first-layer filters out to see what the network decided edges were.",
    period: "Feb–Mar 2026",
    lead: "Nimansh",
    spec: [
      ["Params", "312k"],
      ["Epochs", "30"],
      ["Test acc", "99.1%"],
      ["Aug", "Shift + rotate"],
    ],
    sections: [
      {
        heading: "Architecture",
        body: "Three convolution blocks — 32, 64 and 128 filters, each with batch norm and a 2×2 max pool — into a 128-unit dense layer with dropout at 0.4. Nothing exotic. The point was to build it end to end rather than import it.",
      },
      {
        heading: "What the filters learned",
        body: "The first layer converged to edge and stroke detectors on its own: diagonals, corners, and a few blob detectors nobody designed. We had described these in a lecture as something CNNs 'tend to learn'. Seeing them appear in our own weights was the moment the architecture stopped being a diagram.",
      },
      {
        heading: "Where it fails",
        body: "Rotate a 6 far enough and it becomes a 9, and the model is confidently wrong. Our augmentation range taught it that moderate rotation doesn't change a label — so at the extreme it applies exactly the rule we gave it. The failure is ours, not the network's.",
      },
    ],
    curves: {
      caption: "Validation accuracy per epoch. The dashed line is training.",
      xLabel: "epoch",
      series: [
        {
          name: "val",
          color: "var(--pen-over)",
          points: [0.71, 0.89, 0.93, 0.951, 0.962, 0.971, 0.977, 0.981, 0.984, 0.987, 0.991],
        },
        {
          name: "train",
          color: "var(--muted)",
          dashed: true,
          points: [0.64, 0.86, 0.92, 0.947, 0.961, 0.973, 0.981, 0.988, 0.993, 0.996, 0.998],
        },
      ],
      ticks: ["0", "6", "12", "18", "24", "30"],
    },
  },
  {
    slug: "linear-baseline",
    title: "The linear model we couldn't beat for two weeks",
    tag: "Regression",
    pen: "var(--pen-under)",
    summary:
      "A four-feature least-squares fit on housing data. Every deeper model we tried lost to it until we fixed the feature scaling.",
    period: "Jan–Feb 2026",
    lead: "Pragyan",
    spec: [
      ["Features", "4"],
      ["Method", "Normal equations"],
      ["R²", "0.79"],
      ["Runtime", "12 ms"],
    ],
    sections: [
      {
        heading: "The baseline",
        body: "Closed-form least squares on four features. It trains in twelve milliseconds, the coefficients mean something you can say out loud, and it set the number every later model had to clear.",
      },
      {
        heading: "Two weeks of losing",
        body: "Our first neural network lost to it. So did the second. The problem was never capacity — it was that we had left one feature two orders of magnitude larger than the rest, and gradient descent spent its time crawling along a canyon. Standardising the inputs fixed in one line what a week of architecture changes hadn't.",
      },
      {
        heading: "Why the baseline stays",
        body: "It's still the first thing we run on any new tabular dataset. If a deep model can't beat a linear fit, the deep model isn't the interesting result — the bug is.",
      },
    ],
    curves: {
      caption: "Residuals stay flat across the fitted range — no missed curvature.",
      xLabel: "predicted value",
      series: [
        {
          name: "residual",
          color: "var(--pen-under)",
          points: [0.02, -0.03, 0.01, 0.04, -0.02, 0.0, 0.03, -0.04, 0.01, 0.02, -0.01],
        },
      ],
      ticks: ["low", "", "mid", "", "high", ""],
    },
  },
];

// PLACEHOLDER emails and GitHub handles — swap these for the real ones.
export const team = [
  {
    name: "Yash Kumar Sah",
    role: "Member",
    focus: "Regression, model selection, and the fit study.",
    email: "yash@blackbox.dev",
    github: "yashkumarsah",
  },
  {
    name: "Nimansh Dahal",
    role: "Member",
    focus: "Convolutional nets and the vision pipeline.",
    email: "nimansh@blackbox.dev",
    github: "nimanshdahal",
  },
  {
    name: "Pragyan Devkota",
    role: "Member",
    focus: "Baselines, feature scaling, evaluation discipline.",
    email: "pragyan@blackbox.dev",
    github: "pragyandevkota",
  },
  {
    name: "Garima Bartaula",
    role: "Member",
    focus: "Data collection, splits, and reproducibility.",
    email: "garima@blackbox.dev",
    github: "garimabartaula",
  },
  {
    name: "Arshiya Shah",
    role: "Member",
    focus: "Visualisation and the plots on this site.",
    email: "arshiya@blackbox.dev",
    github: "arshiyashah",
  },
  {
    name: "Kripesh Raj Sharma",
    role: "Member",
    focus: "Training infrastructure and experiment tracking.",
    email: "kripesh@blackbox.dev",
    github: "kripeshrajsharma",
  },
];

export const mentors = [
  {
    name: "Aadim Nepal",
    role: "Mentor",
    focus: "Guides the research direction and reviews methodology.",
    email: "aadim@blackbox.dev",
    github: "aadimnepal",
  },
  {
    name: "Ashok Timsina",
    role: "Mentor",
    focus: "Advises on evaluation, statistics, and writeups.",
    email: "ashok@blackbox.dev",
    github: "ashoktimsina",
  },
];

export const contact = {
  email: "team@blackbox.dev",
  github: "blackbox-ai",
};

export const posts = [
  {
    slug: "plot-both-losses",
    title: "Plot both losses or plot neither",
    date: "2026-04-12",
    author: "Yash Kumar Sah",
    read: "3 min",
    excerpt:
      "A single loss curve can't tell you whether you're learning or memorising. We stopped accepting training-only plots in group reviews.",
    body: [
      "For the first month, every plot we produced showed one line going down. It looked like progress. It was, in the strict sense — the number was falling. But a falling training loss is not evidence of learning. It is evidence of fitting, and fitting is something a lookup table does perfectly.",
      "The change was small: every notebook now plots the validation loss on the same axes, in magenta, from the very first epoch. Not at the end, not on request. From the start.",
      "The first time we did this on the Y-shaped fit, the answer arrived in about four seconds. The two lines tracked each other until degree 6, then split — training kept falling, validation turned and climbed. Nobody had to argue about whether the model was overfitting. You could see the fork.",
      "The rule we settled on: if you cannot show us both curves, you have not finished the experiment. A single curve is a claim. Two curves are a result.",
    ],
  },
  {
    slug: "scale-before-you-blame",
    title: "Scale your features before you blame your architecture",
    date: "2026-03-02",
    author: "Pragyan Devkota",
    read: "4 min",
    excerpt:
      "Two weeks lost to a mis-scaled column. Standardisation is now step zero in every notebook template we use.",
    body: [
      "Our linear baseline scored 0.79. Our first neural network scored 0.71. Our second, with more layers, scored 0.69. The obvious reading was that the problem was too simple for a deep model, and we nearly wrote that down as a finding.",
      "It wasn't true. One feature ran in the thousands while the others sat between zero and one. Gradient descent doesn't see features, it sees a loss surface, and that surface was a canyon — steep in one direction, nearly flat in every other. The optimiser spent its entire budget bouncing off the walls.",
      "One line of standardisation. The network cleared the baseline on the next run.",
      "The lesson isn't about scaling, which everyone already knows. It's about what we did with a surprising result: we reached for an interesting explanation before we checked a boring one. Interesting explanations are expensive. Check the boring ones first.",
    ],
  },
  {
    slug: "the-baseline-is-a-result",
    title: "The baseline is a result, not a formality",
    date: "2026-02-18",
    author: "Garima Bartaula",
    read: "2 min",
    excerpt:
      "A linear model that wins is telling you something true about the data. Write it down instead of skipping past it.",
    body: [
      "There's a habit of treating the baseline as a box to tick on the way to the model you actually wanted to build. Run it, note it, move on. We had that habit.",
      "But a twelve-millisecond linear fit that beats your network is not a formality. It's a measurement. It says the relationship in this data is mostly linear, or your features are mostly noise, or your training has a bug. All three are worth knowing, and all three are invisible if you skip past the number on your way to the architecture diagram.",
      "Our baseline now gets a paragraph in every writeup, not a footnote. If the deep model wins, we say by how much and at what cost in parameters and runtime. If it loses, that's the headline.",
    ],
  },
  {
    slug: "what-the-filters-learned",
    title: "Nobody told the network what an edge was",
    date: "2026-03-24",
    author: "Nimansh Dahal",
    read: "3 min",
    excerpt:
      "We pulled the first convolution layer out and rendered its 32 filters as images. They had invented edge detection by themselves.",
    body: [
      "We had been told, in a lecture, that early convolution layers 'tend to learn' edge detectors. It's the kind of sentence you write down and believe without believing.",
      "So we rendered ours. Thirty-two filters from the first layer of our own network, trained on our own machine, scaled up to 8×8 grids of pixels you can actually look at.",
      "Diagonals. Corners. A couple of centre-surround blobs. Nobody designed them. There is no line in our code that mentions an edge. The network was handed pixels and a loss function, and it decided, on its own, that edges were the useful thing to measure first.",
      "This is the moment the CNN stopped being an architecture diagram for us and became a thing that does something. We recommend the exercise. It takes twenty minutes and it changes how the whole rest of the course reads.",
    ],
  },
];
