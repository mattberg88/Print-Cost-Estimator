"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { ACCEPTED_EXTENSIONS, loadModelFile, sampleModel, type LoadedModel } from "@/lib/loadModel";
import { estimate, PRINTERS, UNIT_TO_MM, type FitResult, type Unit } from "@/lib/printers";

const ModelViewer = dynamic(() => import("./ModelViewer"), {
  ssr: false,
  loading: () => <div className="viewer-placeholder">Loading 3D viewer…</div>,
});

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const num = (n: number, d = 1) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });

function fmtHours(h: number) {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return mins ? `${whole} h ${mins} min` : `${whole} h`;
}

const FIT_LABEL: Record<FitResult, string> = { fits: "Fits", rotate: "Fits if rotated", "too-big": "Too big" };

export default function Estimator() {
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [unit, setUnit] = useState<Unit>("mm");
  const [wastePct, setWastePct] = useState(10);
  const [density, setDensity] = useState(1.1);
  const [prices, setPrices] = useState<Record<string, number>>(() =>
    Object.fromEntries(PRINTERS.map((p) => [p.id, p.resin.price])),
  );
  const [selectedId, setSelectedId] = useState<string>(PRINTERS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      // Let the spinner paint before heavy parsing on the main thread.
      await new Promise((r) => setTimeout(r, 30));
      const m = await loadModelFile(file);
      setModel((prev) => {
        prev?.geometry.dispose();
        return m;
      });
      setUnit(m.defaultUnit);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSample = () => {
    setError(null);
    const m = sampleModel();
    setModel((prev) => {
      prev?.geometry.dispose();
      return m;
    });
    setUnit("mm");
  };

  const scale = UNIT_TO_MM[unit];
  const stats = useMemo(() => {
    if (!model) return null;
    return {
      volumeMm3: model.volume * scale ** 3,
      areaMm2: model.area * scale ** 2,
      size: { x: model.size.x * scale, y: model.size.y * scale, z: model.size.z * scale },
    };
  }, [model, scale]);

  const rows = useMemo(() => {
    if (!stats) return [];
    return PRINTERS.map((p) =>
      estimate(p, prices[p.id] ?? p.resin.price, stats.volumeMm3, stats.size, wastePct, density),
    ).sort((a, b) => a.cost - b.cost);
  }, [stats, prices, wastePct, density]);

  const cheapestFitting = rows.find((r) => r.fit !== "too-big");
  const selected = rows.find((r) => r.printer.id === selectedId);
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
            <ModelViewer model={model} scale={scale} printer={selected?.printer} fit={selected?.fit} />
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
          {model && selected && (
            <div className="viewer-legend">
              Showing {selected.printer.brand} {selected.printer.model} build volume ·{" "}
              <span className={`fit ${selected.fit}`}>{FIT_LABEL[selected.fit]}</span>
            </div>
          )}
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
                  {num(stats.volumeMm3 / 1000, 2)} <span>ml</span>
                </div>
                <div className="muted">{num(stats.volumeMm3, 0)} mm³</div>
              </div>
              {cheapestFitting && (
                <div className="hero-right">
                  <div className="label">Cheapest that fits</div>
                  <div className="hero-num">{usd.format(cheapestFitting.cost)}</div>
                  <div className="muted">{cheapestFitting.printer.model}</div>
                </div>
              )}
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
          <p className="muted">Load a model to see its volume and cost on each printer.</p>
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
          <label>
            <span>Supports &amp; waste</span>
            <div className="range-row">
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={wastePct}
                onChange={(e) => setWastePct(Number(e.target.value))}
              />
              <output>{wastePct}%</output>
            </div>
          </label>
          <label>
            <span>Resin density (g/ml)</span>
            <input
              type="number"
              min={0.8}
              max={2}
              step={0.01}
              value={density}
              onChange={(e) => setDensity(Number(e.target.value) || 1.1)}
            />
          </label>
        </div>
        <p className="hint">Assumes a solid print. Prices are editable defaults; resin sales change them often.</p>
      </section>

      <section className="panel results">
        <div className="results-head">
          <h2>Cost by printer</h2>
          {rows.length > 0 && <span className="muted">Click a row to preview its build volume</span>}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Printer</th>
                <th className="num">Cost</th>
                <th className="num">Resin used</th>
                <th className="num">Est. time</th>
                <th>Fit</th>
                <th>Resin price</th>
              </tr>
            </thead>
            <tbody>
              {(rows.length
                ? rows
                : PRINTERS.map((p) => ({ printer: p, price: prices[p.id], resinMl: 0, resinG: 0, cost: 0, hours: 0, fit: null }))
              ).map((r) => {
                const p = r.printer;
                const isSel = p.id === selectedId && rows.length > 0;
                const isBest = cheapestFitting?.printer.id === p.id;
                return (
                  <tr
                    key={p.id}
                    className={`${isSel ? "selected" : ""} ${r.fit === "too-big" ? "dim" : ""}`}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <td>
                      <div className="printer-name">
                        {p.brand} {p.model}
                        {isBest && <span className="badge">Best price</span>}
                      </div>
                      <div className="muted small">
                        {p.tech} · {p.build.x} × {p.build.y} × {p.build.z} mm · {p.resin.name}
                      </div>
                    </td>
                    <td className="num cost">{rows.length ? usd.format(r.cost) : "—"}</td>
                    <td className="num">{rows.length ? `${num(r.resinMl, 1)} ml` : "—"}</td>
                    <td className="num">{rows.length ? fmtHours(r.hours) : "—"}</td>
                    <td>{r.fit ? <span className={`fit ${r.fit}`}>{FIT_LABEL[r.fit]}</span> : "—"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="price-input">
                        <span>$</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={prices[p.id]}
                          aria-label={`${p.model} resin price`}
                          onChange={(e) => setPrices((s) => ({ ...s, [p.id]: Number(e.target.value) || 0 }))}
                        />
                        <span className="muted">/{p.resin.unit}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Resin used = solid volume + supports &amp; waste. Print time is a rough height-based estimate (resin printers cure a
          whole layer at once), assuming the model is printed in its current orientation.
        </p>
      </section>
    </div>
  );
}
