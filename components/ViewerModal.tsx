"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { UNIT_TO_MM } from "@/lib/units";
import type { Measured, QuotePart } from "./PartCard";

const ModelViewer = dynamic(() => import("./ModelViewer"), {
  ssr: false,
  loading: () => <div className="viewer-placeholder">Loading 3D viewer…</div>,
});

const n = (v: number, d = 2) => v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });

export default function ViewerModal({ part, measured, onClose }: { part: QuotePart; measured: Measured; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const s = measured.size;
  const watertight = part.model.badEdges === 0;
  const maxDim = Math.max(s.x, s.y, s.z);
  const unitsOk = measured.volumeMm3 >= 1 && maxDim <= 3000;
  const checks = [
    { label: "Closed, watertight mesh", ok: watertight, note: watertight ? "Volume is exact" : `${part.model.badEdges.toLocaleString()} open edges` },
    { label: "Size and units look right", ok: unitsOk, note: unitsOk ? `Read as ${part.unit}` : "Check the file units" },
    { label: "Single readable model", ok: true, note: `${part.model.parts} ${part.model.parts === 1 ? "body" : "bodies"}` },
  ];

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`${part.model.name} 3D view`}>
        <div className="modal-viewer">
          <ModelViewer model={part.model} scale={UNIT_TO_MM[part.unit]} />
          <span className="modal-hint">Drag to rotate · scroll to zoom · right-drag to pan</span>
        </div>
        <div className="modal-side">
          <div className="modal-head">
            <h2 title={part.model.name}>{part.model.name}</h2>
            <button type="button" className="icon-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>

          <div className="field-label">Dimensions</div>
          <dl className="stat-list">
            <div>
              <dt>Length</dt>
              <dd>
                {n(s.x)} mm <span>({n(s.x / 25.4, 3)} in)</span>
              </dd>
            </div>
            <div>
              <dt>Width</dt>
              <dd>
                {n(s.z)} mm <span>({n(s.z / 25.4, 3)} in)</span>
              </dd>
            </div>
            <div>
              <dt>Height</dt>
              <dd>
                {n(s.y)} mm <span>({n(s.y / 25.4, 3)} in)</span>
              </dd>
            </div>
          </dl>

          <div className="field-label">Geometry</div>
          <dl className="stat-list">
            <div>
              <dt>Volume</dt>
              <dd>
                {n(measured.volumeMm3 / 1000)} cm³ <span>({n(measured.volumeMm3 / 16387.064, 3)} in³)</span>
              </dd>
            </div>
            <div>
              <dt>Surface area</dt>
              <dd>{n(measured.areaMm2 / 100, 1)} cm²</dd>
            </div>
            <div>
              <dt>Est. support volume</dt>
              <dd>{n(measured.supportMm3 / 1000, 1)} cm³</dd>
            </div>
            <div>
              <dt>Triangles</dt>
              <dd>{part.model.triangles.toLocaleString()}</dd>
            </div>
          </dl>

          <div className="field-label">Model checks</div>
          <ul className="checks">
            {checks.map((c) => (
              <li key={c.label} className={c.ok ? "ok" : "warn"}>
                <span className="check-dot" aria-hidden>
                  {c.ok ? "✓" : "!"}
                </span>
                <span>
                  {c.label}
                  <small>{c.note}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
