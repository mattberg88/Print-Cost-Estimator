"use client";

import { useState } from "react";
import type { LoadedModel } from "@/lib/loadModel";
import {
  MATERIALS,
  POLYJET_LAYER,
  PROCESS_INFO,
  SLA_LAYERS,
  TURNAROUNDS,
  type Breakdown,
  type OrderPricing,
  type ProcessId,
  type TurnaroundId,
} from "@/lib/options";
import type { Unit } from "@/lib/units";

export interface QuotePart {
  key: string;
  model: LoadedModel;
  unit: Unit;
  quantity: number;
  process: ProcessId;
  material: string;
  slaLayer: number;
  thumb: string;
}

export interface Measured {
  volumeMm3: number;
  areaMm2: number;
  size: { x: number; y: number; z: number };
  supportMm3: number;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const n1 = (v: number, d = 2) => v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const PROCESSES: ProcessId[] = ["sla", "polyjet", "fdm"];

interface Props {
  index: number;
  part: QuotePart;
  measured: Measured;
  pricing: Record<TurnaroundId, OrderPricing> | null;
  turnaround: TurnaroundId;
  loading: boolean;
  isAdmin: boolean;
  onChange: (patch: Partial<QuotePart>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onView: () => void;
  onTurnaround: (t: TurnaroundId) => void;
}

export default function PartCard({
  index,
  part,
  measured,
  pricing,
  turnaround,
  loading,
  isAdmin,
  onChange,
  onRemove,
  onDuplicate,
  onView,
  onTurnaround,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [showBd, setShowBd] = useState(false);
  const mats = MATERIALS[part.process];
  const matLabel = mats.find((m) => m.id === part.material)?.label ?? mats[0].label;
  const s = measured.size;
  const inch = (mm: number) => n1(mm / 25.4, 3);
  const lineFor = (t: TurnaroundId) => pricing?.[t].lines.find((l) => l.id === part.key);
  const sel = lineFor(turnaround);

  const setProcess = (p: ProcessId) => onChange({ process: p, material: MATERIALS[p][0].id });

  return (
    <article className="part-card">
      <div className="pc-grid">
        <button type="button" className="pc-thumb" onClick={onView} aria-label={`View ${part.model.name} in 3D`}>
          {part.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={part.thumb} alt="" />
          ) : (
            <span className="pc-thumb-fallback">3D</span>
          )}
          <span className="pc-thumb-hint">View 3D</span>
        </button>

        <div className="pc-info">
          <div className="pc-title-row">
            <span className="pc-index">{index}</span>
            <h3 className="pc-name" title={part.model.name}>
              {part.model.name}
            </h3>
          </div>
          <div className="pc-actions">
            <button type="button" className="btn-ghost" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
              {editing ? "Done" : "Edit configuration"}
            </button>
            <button type="button" className="btn-ghost" onClick={onDuplicate}>
              Duplicate
            </button>
            <button type="button" className="btn-ghost danger" onClick={onRemove}>
              Remove
            </button>
          </div>

          {!editing ? (
            <dl className="pc-spec">
              <div>
                <dt>Process</dt>
                <dd>{PROCESS_INFO[part.process].full}</dd>
              </div>
              <div>
                <dt>Material</dt>
                <dd>{matLabel}</dd>
              </div>
              <div>
                <dt>Layer height</dt>
                <dd>{part.process === "sla" ? `${part.slaLayer} mm` : part.process === "polyjet" ? `${POLYJET_LAYER} mm` : "Standard"}</dd>
              </div>
              <div>
                <dt>Measurement</dt>
                <dd>
                  {n1(s.x)} × {n1(s.z)} × {n1(s.y)} mm, {Math.round(measured.volumeMm3).toLocaleString()} mm³
                  <span className="pc-sub">
                    {inch(s.x)} × {inch(s.z)} × {inch(s.y)} in, {n1(measured.volumeMm3 / 16387.064, 3)} in³
                  </span>
                </dd>
              </div>
              {part.model.badEdges > 0 && (
                <div>
                  <dt>Model check</dt>
                  <dd className="warn-text">Mesh has holes; volume may be off</dd>
                </div>
              )}
            </dl>
          ) : (
            <div className="pc-edit">
              <div className="field">
                <span className="field-label">Process</span>
                <div className="proc-tiles" role="radiogroup" aria-label="Process">
                  {PROCESSES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={part.process === p}
                      className={`proc-tile ${part.process === p ? "on" : ""}`}
                      onClick={() => setProcess(p)}
                    >
                      <strong>{PROCESS_INFO[p].name}</strong>
                      <span>{PROCESS_INFO[p].blurb}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="pc-edit-row">
                <label className="field">
                  <span className="field-label">Material</span>
                  <select value={part.material} onChange={(e) => onChange({ material: e.target.value })}>
                    {mats.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                {part.process === "sla" && (
                  <label className="field">
                    <span className="field-label">Layer height</span>
                    <select value={part.slaLayer} onChange={(e) => onChange({ slaLayer: Number(e.target.value) })}>
                      {SLA_LAYERS.map((l) => (
                        <option key={l} value={l}>
                          {l} mm
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="field">
                  <span className="field-label">File units</span>
                  <select value={part.unit} onChange={(e) => onChange({ unit: e.target.value as Unit })}>
                    <option value="mm">Millimeters</option>
                    <option value="cm">Centimeters</option>
                    <option value="m">Meters</option>
                    <option value="in">Inches</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="pc-price">
          <div className="pc-qty">
            <span className="field-label">Quantity</span>
            <div className="stepper">
              <button type="button" aria-label="Decrease quantity" onClick={() => onChange({ quantity: Math.max(1, part.quantity - 1) })}>
                −
              </button>
              <input
                type="number"
                min={1}
                value={part.quantity}
                aria-label="Quantity"
                onChange={(e) => onChange({ quantity: Number(e.target.value) })}
              />
              <button type="button" aria-label="Increase quantity" onClick={() => onChange({ quantity: part.quantity + 1 })}>
                +
              </button>
            </div>
          </div>

          <div className="field-label pc-lead-label">Price and lead time</div>
          <div className={`lead-list ${loading ? "is-loading" : ""}`}>
            {TURNAROUNDS.map((t) => {
              const l = lineFor(t.id);
              const on = t.id === turnaround;
              return (
                <button key={t.id} type="button" className={`lead-opt ${on ? "on" : ""}`} onClick={() => onTurnaround(t.id)}>
                  <span className="lead-name">
                    {t.label}
                    <small>{t.note}</small>
                  </span>
                  <span className="lead-price">
                    {l ? usd.format(l.total) : "—"}
                    {l && part.quantity > 1 && <small>{usd.format(l.perPart)} ea.</small>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isAdmin && sel?.breakdown && (
        <div className="pc-admin">
          <button type="button" className="admin-toggle" onClick={() => setShowBd((v) => !v)} aria-expanded={showBd}>
            <span className="admin-badge">Admin</span> Cost breakdown for this part
            <span className="chev">{showBd ? "−" : "+"}</span>
          </button>
          {showBd && <BreakdownList b={sel.breakdown} total={sel.total} label="Line total" />}
        </div>
      )}
    </article>
  );
}

export function BreakdownList({ b, total, label }: { b: Breakdown; total: number; label: string }) {
  const rows: [string, string][] = [
    ["Setup", usd.format(b.setup)],
    ["Material", usd.format(b.material)],
    ["Support", b.support ? usd.format(b.support) : "—"],
    ["Build time", usd.format(b.buildTime)],
    ["Markup & adjustments", `${usd.format(b.markup)} (×${Number(b.markupFactor.toFixed(2))})`],
  ];
  if (b.minimumAdjustment > 0.005) rows.push(["Minimum order adjustment", usd.format(b.minimumAdjustment)]);
  return (
    <dl className="bd">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
      <div className="bd-total">
        <dt>{label}</dt>
        <dd>{usd.format(total)}</dd>
      </div>
    </dl>
  );
}
