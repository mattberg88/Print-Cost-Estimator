"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { ACCEPTED_EXTENSIONS, loadModelFile, sampleModel, type LoadedModel } from "@/lib/loadModel";
import { UNIT_TO_MM, type Unit } from "@/lib/units";
import ServiceQuote from "./ServiceQuote";

const ModelViewer = dynamic(() => import("./ModelViewer"), {
  ssr: false,
  loading: () => <div className="viewer-placeholder">Loading 3D viewer…</div>,
});

const num = (n: number, d = 1) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });

export default function Estimator() {
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [unit, setUnit] = useState<Unit>("mm");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const replaceModel = (m: LoadedModel) =>
    setModel((prev) => {
      prev?.geometry.dispose();
      return m;
    });

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      // Let the spinner paint before heavy parsing on the main thread.
      await new Promise((r) => setTimeout(r, 30));
      const m = await loadModelFile(file);
      replaceModel(m);
      setUnit(m.defaultUnit);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSample = () => {
    setError(null);
    replaceModel(sampleModel());
    setUnit("mm");
  };

  const scale = UNIT_TO_MM[unit];
  const stats = useMemo(() => {
    if (!model) return null;
    return {
      volumeMm3: model.volume * scale ** 3,
      areaMm2: model.area * scale ** 2,
      size: { x: model.size.x * scale, y: model.size.y * scale, z: model.size.z * scale },
      supportMm3: model.supportVolume * scale ** 3,
    };
  }, [model, scale]);

  const quoteGeometry = useMemo(
    () =>
      stats
        ? { volume: stats.volumeMm3, area: stats.areaMm2, size: stats.size, supportVolume: stats.supportMm3 }
        : null,
    [stats],
  );

  const tiny = stats && stats.volumeMm3 < 1;
  const huge = stats && Math.max(stats.size.x, stats.size.y, stats.size.z) > 3000;

  return (
    <div className="layout">
      <section className="panel viewer-panel">
        <div
          className={`viewer ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
        >
          {model ? (
            <ModelViewer model={model} scale={scale} />
          ) : (
            <div className="dropzone">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
                <path d="m3 7 9 5 9-5M12 12v10" />
              </svg>
              <p className="drop-title">Drop a 3D model here</p>
              <p className="muted">STL, OBJ, 3MF, PLY or GLB · processed in your browser, never uploaded</p>
              <div className="drop-actions">
                <button className="btn primary" onClick={() => inputRef.current?.click()}>
                  Choose file
                </button>
                <button className="btn" onClick={loadSample}>
                  Try a sample
                </button>
              </div>
            </div>
          )}
          {loading && <div className="overlay">Reading model…</div>}
        </div>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(",")}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {model && (
          <div className="file-bar">
            <span className="file-name" title={model.name}>
              {model.name}
            </span>
            <span className="muted">{model.format}</span>
            <button className="btn small" onClick={() => inputRef.current?.click()}>
              Replace
            </button>
          </div>
        )}
        {error && <div className="alert error">{error}</div>}
      </section>

      <section className="panel side">
        <h2>Model</h2>
        {stats && model ? (
          <>
            <div className="stat-hero">
              <div>
                <div className="label">Volume (solid)</div>
                <div className="hero-num">
                  {num(stats.volumeMm3 / 1000, 2)} <span>cm³</span>
                </div>
                <div className="muted">{num(stats.volumeMm3, 0)} mm³</div>
              </div>
            </div>
            <dl className="stats">
              <div>
                <dt>Size (W × D × H)</dt>
                <dd>
                  {num(stats.size.x)} × {num(stats.size.z)} × {num(stats.size.y)} mm
                </dd>
              </div>
              <div>
                <dt>Surface area</dt>
                <dd>{num(stats.areaMm2 / 100, 1)} cm²</dd>
              </div>
              <div>
                <dt>Est. support volume</dt>
                <dd>{num(stats.supportMm3 / 1000, 1)} cm³</dd>
              </div>
              <div>
                <dt>Triangles</dt>
                <dd>{model.triangles.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Mesh</dt>
                <dd className={model.badEdges ? "warn-text" : "ok-text"}>
                  {model.badEdges ? `Not watertight (${model.badEdges.toLocaleString()} open edges)` : "Watertight"}
                </dd>
              </div>
            </dl>
            {model.badEdges > 0 && (
              <div className="alert warn">
                The mesh has holes, so the volume may be off. Repair it in your slicer or Meshmixer for an accurate number.
              </div>
            )}
            {(tiny || huge) && (
              <div className="alert warn">
                That size looks {tiny ? "very small" : "very large"}. The file may use different units; try the unit selector
                below.
              </div>
            )}
          </>
        ) : (
          <p className="muted">Upload a model to see its size and volume.</p>
        )}

        <h2>Settings</h2>
        <div className="settings">
          <label>
            <span>File units</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
              <option value="mm">Millimeters</option>
              <option value="cm">Centimeters</option>
              <option value="m">Meters</option>
              <option value="in">Inches</option>
            </select>
          </label>
        </div>
      </section>

      <ServiceQuote geometry={quoteGeometry} />
    </div>
  );
}
