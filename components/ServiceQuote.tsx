"use client";

import { useEffect, useState } from "react";
import {
  FDM_MATERIALS,
  MINIMUM_ORDER,
  POLYJET_LAYER,
  POLYJET_MATERIALS,
  SLA_DEFAULT_LAYER,
  SLA_LAYERS,
  SLA_RESINS,
  TURNAROUNDS,
  type Breakdown,
  type ProcessId,
  type QuoteRequest,
  type QuoteResponse,
} from "@/lib/options";
import { useAdmin } from "./AdminContext";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "—" : usd.format(v));

interface Props {
  geometry: Pick<QuoteRequest, "volume" | "area" | "size" | "supportVolume"> | null;
}

const PROCESSES: { id: ProcessId; name: string; blurb: string }[] = [
  { id: "sla", name: "SLA", blurb: "Smooth, fine detail" },
  { id: "polyjet", name: "PolyJet", blurb: "Multi-material, very fine layers" },
  { id: "fdm", name: "FDM", blurb: "Strong, economical parts" },
];

const BREAKDOWN_ROWS: { label: string; get: (b: Breakdown) => string; strong?: boolean }[] = [
  { label: "Setup", get: (b) => fmt(b.setup) },
  { label: "Material", get: (b) => fmt(b.material) },
  { label: "Support", get: (b) => fmt(b.support) },
  { label: "Build time", get: (b) => fmt(b.buildTime) },
  { label: "Markup & adjustments", get: (b) => `${fmt(b.markup)} (×${Number(b.markupFactor.toFixed(2))})` },
  { label: "Minimum order adjustment", get: (b) => (b.minimumAdjustment > 0.005 ? fmt(b.minimumAdjustment) : "—") },
];

export default function ServiceQuote({ geometry }: Props) {
  const { admin } = useAdmin();
  const [quantity, setQuantity] = useState(1);
  const [turnaround, setTurnaround] = useState<string>(TURNAROUNDS[0].id);
  const [slaResin, setSlaResin] = useState<string>(SLA_RESINS[0].id);
  const [slaLayer, setSlaLayer] = useState<number>(SLA_DEFAULT_LAYER);
  const [pjMat, setPjMat] = useState<string>(POLYJET_MATERIALS[0].id);
  const [fdmMat, setFdmMat] = useState<string>(FDM_MATERIALS[0].id);
  const [data, setData] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(true);

  const qty = Math.max(1, Math.floor(quantity) || 1);

  useEffect(() => {
    if (!geometry || geometry.volume <= 0) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    const body: QuoteRequest = {
      ...geometry,
      quantity: qty,
      turnaround,
      slaResin,
      slaLayer,
      polyjetMaterial: pjMat,
      fdmMaterial: fdmMat,
    };
    setLoading(true);
    const t = setTimeout(() => {
      fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Couldn't get a price.");
          return r.json() as Promise<QuoteResponse>;
        })
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message || "Couldn't get a price.");
        })
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [geometry, qty, turnaround, slaResin, slaLayer, pjMat, fdmMat, admin]);

  const quotes = data?.quotes ?? null;
  const isAdmin = admin && !!data?.admin;
  const lowest = quotes
    ? (Object.keys(quotes) as ProcessId[]).reduce((a, b) => (quotes[a].total <= quotes[b].total ? a : b))
    : null;
  const allAtMinimum = quotes ? PROCESSES.every((p) => quotes[p.id].minimumApplied) : false;
  const best = (id: ProcessId) => (lowest === id && !allAtMinimum ? "best" : "");

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
            {TURNAROUNDS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={turnaround === p.id}
                className={turnaround === p.id ? "on" : ""}
                onClick={() => setTurnaround(p.id)}
              >
                {p.label}
                <small>{p.note}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="min-note">
          <strong>${MINIMUM_ORDER}</strong> minimum order
        </div>
      </div>

      <div className={`compare-wrap ${loading ? "is-loading" : ""}`}>
        <table className="compare">
          <thead>
            <tr>
              <th scope="col" className="rowhead" />
              {PROCESSES.map((p) => (
                <th scope="col" key={p.id} className={best(p.id)}>
                  <div className="proc-name">
                    {p.name}
                    {best(p.id) && <span className="badge">Lowest</span>}
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
              {PROCESSES.map((p) => {
                const q = quotes?.[p.id];
                return (
                  <td key={p.id} className={best(p.id)}>
                    <div className="price">{q ? usd.format(q.total) : "—"}</div>
                    {q && qty > 1 && <div className="each">{usd.format(q.perPart)} each</div>}
                    {q?.minimumApplied && <div className="each">Minimum order</div>}
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row" className="rowhead">
                Material
              </th>
              <td className={best("sla")}>
                <select value={slaResin} onChange={(e) => setSlaResin(e.target.value)} aria-label="SLA resin">
                  {SLA_RESINS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className={best("polyjet")}>
                <select value={pjMat} onChange={(e) => setPjMat(e.target.value)} aria-label="PolyJet material">
                  {POLYJET_MATERIALS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className={best("fdm")}>
                <select value={fdmMat} onChange={(e) => setFdmMat(e.target.value)} aria-label="FDM material">
                  {FDM_MATERIALS.map((m) => (
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
              <td className={best("sla")}>
                <select value={slaLayer} onChange={(e) => setSlaLayer(Number(e.target.value))} aria-label="SLA layer height">
                  {SLA_LAYERS.map((l) => (
                    <option key={l} value={l}>
                      {l} mm
                    </option>
                  ))}
                </select>
              </td>
              <td className={`fixed ${best("polyjet")}`}>{POLYJET_LAYER} mm</td>
              <td className={`fixed ${best("fdm")}`}>—</td>
            </tr>
            {isAdmin && showDetails && quotes && (
              <>
                <tr className="admin-divider">
                  <th scope="row" colSpan={4}>
                    <span className="admin-badge">Admin</span> Cost breakdown (per part)
                  </th>
                </tr>
                {BREAKDOWN_ROWS.map((r) => (
                  <tr key={r.label} className="detail-row">
                    <th scope="row" className="rowhead">
                      {r.label}
                    </th>
                    {PROCESSES.map((p) => {
                      const b = quotes[p.id].breakdown;
                      return (
                        <td key={p.id} className={best(p.id)}>
                          {b ? r.get(b) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="detail-row strong">
                  <th scope="row" className="rowhead">
                    Price per part
                  </th>
                  {PROCESSES.map((p) => (
                    <td key={p.id} className={best(p.id)}>
                      {usd.format(quotes[p.id].perPart)}
                    </td>
                  ))}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="quote-foot">
        {isAdmin ? (
          <button type="button" className="link-btn" onClick={() => setShowDetails((s) => !s)} aria-expanded={showDetails}>
            {showDetails ? "Hide cost breakdown" : "Show cost breakdown"}
          </button>
        ) : (
          <span />
        )}
        <p className="muted small">
          {error
            ? error
            : geometry
              ? `Estimated price for the whole order, including the $${MINIMUM_ORDER} minimum. Final pricing is confirmed when you order.`
              : "Upload a model to see prices."}
        </p>
      </div>
    </section>
  );
}
