"use client";

import { useMemo, useState } from "react";
import {
  FDM,
  MINIMUM_ORDER,
  POLYJET,
  PRODUCTION_TIMES,
  SLA,
  applyMinimum,
  quoteFDM,
  quotePolyJet,
  quoteSLA,
  type Quote,
  type QuoteInput,
} from "@/lib/quote";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

interface Props {
  geometry: Omit<QuoteInput, "quantity" | "productionTime"> | null;
}

type ProcessId = "sla" | "polyjet" | "fdm";
const PROCESSES: { id: ProcessId; name: string; blurb: string }[] = [
  { id: "sla", name: "SLA", blurb: "Smooth, fine detail" },
  { id: "polyjet", name: "PolyJet", blurb: "Multi-material, very fine layers" },
  { id: "fdm", name: "FDM", blurb: "Strong, economical parts" },
];

/** Value of a named line item, or null if the process doesn't have it. */
function item(q: Quote | null, label: string) {
  const it = q?.items.find((i) => i.label === label || (label === "Material" && i.label === "Resin"));
  return it ? it.value : null;
}

export default function ServiceQuote({ geometry }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [prodId, setProdId] = useState<string>(PRODUCTION_TIMES[0].id);
  const [slaResin, setSlaResin] = useState(SLA.resins[0].id);
  const [slaLayer, setSlaLayer] = useState(SLA.defaultLayer);
  const [pjMat, setPjMat] = useState(POLYJET.materials[0].id);
  const [fdmMat, setFdmMat] = useState(FDM.materials[0].id);
  const [useMinimum, setUseMinimum] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const productionTime = PRODUCTION_TIMES.find((p) => p.id === prodId)!.factor;
  const qty = Math.max(1, Math.floor(quantity) || 1);

  const quotes = useMemo<Record<ProcessId, Quote> | null>(() => {
    if (!geometry || geometry.volume <= 0) return null;
    const input: QuoteInput = { ...geometry, quantity: qty, productionTime };
    const min = (q: Quote) => (useMinimum ? applyMinimum(q, qty) : q);
    return {
      sla: min(quoteSLA(input, SLA.resins.find((r) => r.id === slaResin)!.costPerMm3, slaLayer)),
      polyjet: min(quotePolyJet(input, POLYJET.materials.find((m) => m.id === pjMat)!.costPerMm3)),
      fdm: min(quoteFDM(input, FDM.materials.find((m) => m.id === fdmMat)!)),
    };
  }, [geometry, qty, productionTime, slaResin, slaLayer, pjMat, fdmMat, useMinimum]);

  const lowest = quotes
    ? (Object.keys(quotes) as ProcessId[]).reduce((a, b) => (quotes[a].total <= quotes[b].total ? a : b))
    : null;

  const multiplier = (q: Quote | null) =>
    q ? q.multipliers.reduce((m, x) => m * x.value, 1) : null;

  const rows: { label: string; get: (id: ProcessId) => string; detail?: boolean }[] = [
    { label: "Setup", get: (id) => fmt(item(quotes?.[id] ?? null, "Setup")), detail: true },
    { label: "Material", get: (id) => fmt(item(quotes?.[id] ?? null, "Material")), detail: true },
    { label: "Support", get: (id) => fmt(item(quotes?.[id] ?? null, "Support")), detail: true },
    { label: "Build time", get: (id) => fmt(item(quotes?.[id] ?? null, "Build time")), detail: true },
    {
      label: "Markup & adjustments",
      get: (id) => {
        const m = multiplier(quotes?.[id] ?? null);
        return m === null ? "—" : `× ${Number(m.toFixed(3))}`;
      },
      detail: true,
    },
  ];

  return (
    <section className="card quote-section" aria-labelledby="quote-h">
      <div className="section-head">
        <h2 id="quote-h">Your estimate</h2>
        <p className="muted">Compare SLA, PolyJet and FDM side by side.</p>
      </div>

      <div className="order-bar">
        <div className="field">
          <span className="field-label">Quantity</span>
          <div className="stepper">
            <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
              −
            </button>
            <input
              type="number"
              min={1}
              step={1}
              value={quantity}
              aria-label="Quantity"
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
            <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((q) => q + 1)}>
              +
            </button>
          </div>
        </div>

        <div className="field">
          <span className="field-label">Turnaround</span>
          <div className="segmented" role="radiogroup" aria-label="Turnaround">
            {PRODUCTION_TIMES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={prodId === p.id}
                className={prodId === p.id ? "on" : ""}
                onClick={() => setProdId(p.id)}
              >
                {p.label.replace(" (2–3 days)", "")}
                <small>{p.id === "standard" ? "2–3 days" : `×${p.factor}`}</small>
              </button>
            ))}
          </div>
        </div>

        <label className="toggle">
          <input type="checkbox" checked={useMinimum} onChange={(e) => setUseMinimum(e.target.checked)} />
          <span className="track" aria-hidden />
          <span>${MINIMUM_ORDER} minimum order</span>
        </label>
      </div>

      <div className="compare-wrap">
        <table className="compare">
          <thead>
            <tr>
              <th scope="col" className="rowhead" />
              {PROCESSES.map((p) => (
                <th scope="col" key={p.id} className={lowest === p.id ? "best" : ""}>
                  <div className="proc-name">
                    {p.name}
                    {lowest === p.id && <span className="badge">Lowest</span>}
                  </div>
                  <div className="proc-blurb">{p.blurb}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="total-row">
              <th scope="row" className="rowhead">
                Total{qty > 1 ? ` (${qty} parts)` : ""}
              </th>
              {PROCESSES.map((p) => (
                <td key={p.id} className={lowest === p.id ? "best" : ""}>
                  <div className="price">{quotes ? usd.format(quotes[p.id].total) : "—"}</div>
                  {quotes && qty > 1 && <div className="each">{usd.format(quotes[p.id].perPart)} each</div>}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="rowhead">
                Material
              </th>
              <td className={lowest === "sla" ? "best" : ""}>
                <select value={slaResin} onChange={(e) => setSlaResin(e.target.value)} aria-label="SLA resin">
                  {SLA.resins.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className={lowest === "polyjet" ? "best" : ""}>
                <select value={pjMat} onChange={(e) => setPjMat(e.target.value)} aria-label="PolyJet material">
                  {POLYJET.materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className={lowest === "fdm" ? "best" : ""}>
                <select value={fdmMat} onChange={(e) => setFdmMat(e.target.value)} aria-label="FDM material">
                  {FDM.materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
            <tr>
              <th scope="row" className="rowhead">
                Layer height
              </th>
              <td className={lowest === "sla" ? "best" : ""}>
                <select value={slaLayer} onChange={(e) => setSlaLayer(Number(e.target.value))} aria-label="SLA layer height">
                  {SLA.layerHeights.map((l) => (
                    <option key={l} value={l}>
                      {l} mm
                    </option>
                  ))}
                </select>
              </td>
              <td className={`fixed ${lowest === "polyjet" ? "best" : ""}`}>{POLYJET.layerHeight} mm</td>
              <td className={`fixed ${lowest === "fdm" ? "best" : ""}`}>—</td>
            </tr>
            {showDetails &&
              rows.map((r) => (
                <tr key={r.label} className="detail-row">
                  <th scope="row" className="rowhead">
                    {r.label}
                  </th>
                  {PROCESSES.map((p) => (
                    <td key={p.id} className={lowest === p.id ? "best" : ""}>
                      {quotes ? r.get(p.id) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="quote-foot">
        <button type="button" className="link-btn" onClick={() => setShowDetails((s) => !s)} aria-expanded={showDetails}>
          {showDetails ? "Hide cost breakdown" : "Show cost breakdown"}
        </button>
        <p className="muted small">
          {geometry
            ? `Estimates for the whole order${useMinimum ? "" : ", before any minimum order charge"}. Setup, material, support and build time are per part, before markup. PolyJet support is estimated from the model.`
            : "Upload a model to see prices."}
        </p>
      </div>
    </section>
  );
}

function fmt(v: number | null) {
  return v === null ? "—" : usd.format(v);
}
