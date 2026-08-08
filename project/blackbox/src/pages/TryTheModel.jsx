import { useEffect, useMemo, useRef, useState } from "react";
import { Reveal } from "../components/Layout";
import SplitText from "../components/SplitText";
import { FALLBACK_CATALOG } from "../data/models";

// Point this at wherever the FastAPI backend actually runs.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function TryTheModel() {
  // -- catalogue ------------------------------------------------------------
  const [catalog, setCatalog] = useState(FALLBACK_CATALOG);
  const [backendUp, setBackendUp] = useState(null); // null = still checking
  const [disease, setDisease] = useState(FALLBACK_CATALOG.diseases[0].name);

  // -- upload ---------------------------------------------------------------
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const group = useMemo(
    () => catalog.diseases.find((d) => d.name === disease) ?? catalog.diseases[0],
    [catalog, disease]
  );
  const selected = group?.models?.[0];

  // Pull the live catalogue; fall back to the bundled copy if the API is down.
  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/models`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.status))))
      .then((data) => {
        if (cancelled || !data?.diseases?.length) return;
        setCatalog(data);
        setBackendUp(true);
        setDisease((cur) =>
          data.diseases.some((d) => d.name === cur) ? cur : data.diseases[0].name
        );
      })
      .catch(() => !cancelled && setBackendUp(false));

    return () => {
      cancelled = true;
    };
  }, []);

  const reset = () => {
    setResult(null);
    setError(null);
  };

  const handleFile = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    reset();
  };

  const onInputChange = (e) => handleFile(e.target.files?.[0]);

  const onDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  useEffect(() => {
    const onPaste = (e) => {
      const item = Array.from(e.clipboardData?.items || []).find((i) =>
        i.type.startsWith("image/")
      );
      if (!item) return;
      e.preventDefault();
      handleFile(item.getAsFile());
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const handleAnalyze = async () => {
    if (!file || !selected) return;
    setLoading(true);
    reset();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", selected.id);

    try {
      const res = await fetch(`${API_URL}/predict`, { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || `Server responded with ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Couldn't reach the backend. Is uvicorn running on port 8000?"
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  const unavailable = backendUp === true && selected?.available === false;

  return (
    <section className="band shell">
      <Reveal variant="fade">
        <p className="eyebrow">Try the model</p>
      </Reveal>
      <SplitText
        as="h1"
        className="display"
        text="Run a scan through the model and see what it sees"
      />
      <Reveal variant="fade" delay={240}>
        <p className="lede">
          Choose what to detect, drop in an image, and the model returns a prediction
          alongside a Grad-CAM overlay — a heatmap of the regions that actually drove
          its decision.
        </p>
      </Reveal>

      {/* ---------------- detection type + model ---------------- */}

      <Reveal variant="rise" delay={300}>
        <div className="picker">
          <div className="picker__head">
            <p className="eyebrow" style={{ margin: 0 }}>Detection type</p>
            <StatusDot state={backendUp} />
          </div>

          <div className="picker__tabs" role="tablist" aria-label="Detection type">
            {catalog.diseases.map((d) => (
              <button
                key={d.name}
                role="tab"
                aria-selected={d.name === disease}
                className="picker__tab"
                onClick={() => {
                  setDisease(d.name);
                  reset();
                }}
              >
                {d.name}
              </button>
            ))}
          </div>

          {selected && (
            <div className={`mcard ${unavailable ? "is-missing" : ""}`}>
              <div className="mcard__top">
                <h3 className="mcard__name">{selected.name}</h3>
                {unavailable && <span className="badge badge--missing">No weights</span>}
              </div>
              <p className="mcard__summary">{selected.summary}</p>
            </div>
          )}
        </div>
      </Reveal>

      {/* ---------------- upload ---------------- */}

      <Reveal variant="rise" delay={340}>
        <div
          className="upload-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={onInputChange}
            style={{ display: "none" }}
          />
          {previewUrl ? (
            <img src={previewUrl} alt="Selected preview" className="upload-drop__preview" />
          ) : (
            <>
              <span className="upload-drop__icon" aria-hidden="true">↑</span>
              <p>Drag an image here, click to browse, or paste</p>
            </>
          )}
        </div>
      </Reveal>

      <Reveal variant="fade" delay={360}>
        <div className="upload-actions">
          <button className="btn" onClick={handleAnalyze} disabled={!file || loading || unavailable}>
            {loading ? "Analyzing…" : "Analyze"}
          </button>
          {file && (
            <button
              className="btn btn--ghost"
              onClick={() => {
                setFile(null);
                setPreviewUrl(null);
                reset();
              }}
              disabled={loading}
            >
              Clear
            </button>
          )}
        </div>
      </Reveal>

      {unavailable && (
        <Reveal variant="fade">
          <p className="upload-note">
            <b>{selected.name}</b> has no weights on the server yet — drop{" "}
            <code>{selected.weights_file}</code> into <code>backend/weights/</code>,
            then reload this page. No server restart needed.
          </p>
        </Reveal>
      )}

      {error && (
        <Reveal variant="fade">
          <p className="upload-error">{error}</p>
        </Reveal>
      )}

      {/* ---------------- result ---------------- */}

      {result && (
        <Reveal variant="rise">
          <div className="upload-result">
            {result.diagnosis && (
              <div className={`verdict-banner verdict-banner--${result.diagnosis.tone}`}>
                <div>
                  <span className="verdict-banner__label">Diagnosis</span>
                  <b>{result.diagnosis.headline}</b>
                </div>
                <p>
                  {(result.confidence * 100).toFixed(1)}% confidence
                  {result.diagnosis.certainty ? ` · ${result.diagnosis.certainty}` : ""}
                </p>
              </div>
            )}

            <div className="upload-result__images">
              <figure>
                <img src={previewUrl} alt="Original upload" />
                <figcaption>Original</figcaption>
              </figure>
              <figure>
                <img
                  src={`data:image/png;base64,${result.heatmap_base64}`}
                  alt="Grad-CAM overlay"
                />
                <figcaption>Grad-CAM overlay</figcaption>
              </figure>
            </div>

            <div className="upload-result__stats">
              <p>
                <span className="upload-result__label">Predicted class</span>
                <b>{result.predicted_label ?? result.predicted_class}</b>
              </p>
              <p>
                <span className="upload-result__label">Confidence</span>
                <b>{(result.confidence * 100).toFixed(1)}%</b>
              </p>
              {result.latency_ms != null && (
                <p>
                  <span className="upload-result__label">Latency</span>
                  <b style={{ fontSize: "0.95rem" }}>
                    {result.latency_ms} ms · {result.device}
                  </b>
                </p>
              )}
            </div>

            {result.breakdown?.length > 1 && (
              <div className="breakdown">
                <p className="eyebrow" style={{ marginBottom: 12 }}>Class probabilities</p>
                {result.breakdown.slice(0, 6).map((row) => (
                  <div className="breakdown__row" key={row.label}>
                    <span className="breakdown__name">{row.label}</span>
                    <span className="breakdown__track">
                      <span
                        className="breakdown__fill"
                        style={{ width: `${Math.max(row.probability * 100, 0.6)}%` }}
                      />
                    </span>
                    <span className="breakdown__val">
                      {(row.probability * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="upload-note upload-note--quiet">
              Research demo. Not a medical device and not a substitute for a radiologist.
            </p>
          </div>
        </Reveal>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function StatusDot({ state }) {
  const copy =
    state === null ? "checking backend…" : state ? "backend online" : "backend offline";
  const mod = state === null ? "idle" : state ? "up" : "down";
  return (
    <span className={`status status--${mod}`}>
      <span className="status__dot" aria-hidden="true" />
      {copy}
    </span>
  );
}
