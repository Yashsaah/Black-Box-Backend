// Ridge-regularised least squares polynomial fit, solved with Gaussian
// elimination on the normal equations. Small lambda keeps high degrees from
// blowing up numerically without meaningfully changing the fit.

function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    if (Math.abs(M[col][col]) < 1e-12) continue;

    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }

  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = M[r][n];
    for (let c = r + 1; c < n; c++) sum -= M[r][c] * x[c];
    x[r] = Math.abs(M[r][r]) < 1e-12 ? 0 : sum / M[r][r];
  }
  return x;
}

export function polyfit(xs, ys, degree, lambda = 1e-7) {
  const n = degree + 1;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  const b = new Array(n).fill(0);

  for (let i = 0; i < xs.length; i++) {
    const powers = new Array(2 * n).fill(1);
    for (let p = 1; p < 2 * n; p++) powers[p] = powers[p - 1] * xs[i];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) A[r][c] += powers[r + c];
      b[r] += powers[r] * ys[i];
    }
  }
  for (let r = 0; r < n; r++) A[r][r] += lambda * xs.length;

  return solve(A, b);
}

export function polyval(coeffs, x) {
  let y = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) y = y * x + coeffs[i];
  return y;
}

export function mse(coeffs, xs, ys) {
  let sum = 0;
  for (let i = 0; i < xs.length; i++) {
    const e = polyval(coeffs, xs[i]) - ys[i];
    sum += e * e;
  }
  return sum / xs.length;
}

// Deterministic pseudo-random so every visitor sees the same scatter.
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function gauss(rand) {
  const u = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

// The Y-shaped set: a single stem that forks into two branches. x is
// normalised to [-1, 1] so the Vandermonde columns stay well scaled.
export function makeYData() {
  const rand = rng(20260717);
  const train = [];
  const test = [];

  const push = (x, y) => (rand() < 0.75 ? train : test).push([x, y]);

  for (let i = 0; i < 34; i++) {
    const t = i / 33;
    const x = -1 + t * 0.85;
    push(x + gauss(rand) * 0.012, -0.42 + t * 0.5 + gauss(rand) * 0.05);
  }
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const x = -0.15 + t * 1.15;
    push(x + gauss(rand) * 0.012, -0.02 + t * 0.62 + gauss(rand) * 0.055);
  }
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const x = -0.15 + t * 1.15;
    push(x + gauss(rand) * 0.012, -0.02 - t * 0.6 + gauss(rand) * 0.055);
  }

  return { train, test };
}

export const REGIMES = [
  {
    id: "under",
    degree: 1,
    label: "Underfit",
    pen: "var(--pen-under)",
    verdict: "Too rigid to see the fork at all.",
  },
  {
    id: "fit",
    degree: 4,
    label: "Good fit",
    pen: "var(--pen-fit)",
    verdict: "Follows the stem, averages the branches, ignores noise.",
  },
  {
    id: "over",
    degree: 13,
    label: "Overfit",
    pen: "var(--pen-over)",
    verdict: "Chases every stray point. Train loss falls, test loss climbs.",
  },
];
