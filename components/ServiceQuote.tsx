"use client";

import { useMemo, useState } from "react";
import {
  FDM,
  MINIMUM_ORDER,
  POLYJET,
  applyMinimum,
  PRODUCTION_TIMES,
  SLA,
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

function QuoteCard({
  title,
  subtitle,
  quote,
  quantity,
  children,
}: {
  title: string;
  subtitle: string;
  quote: Quote | null;
  quantity: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="quote-card">
      <div className="quote-head">
        <div>
          <div className="quote-title">{title}</div>
          <div className="muted small">{subtitle}</div>
        </div>
        <div className="quote-price">
          <div className="hero-num">{quote ? usd.format(quote.total) : "—"}</div>
          {quote && quantity > 1 && <div className="muted small">{usd.format(quote.perPart)} each</div>}
        </div>
      </div>
      <div className="quote-controls">{children}</div>
      {quote && (
        <>
          <button className="link-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "Hide breakdown" : "Show breakdown"}
          </button>
          {open && (
            <div className="breakdown">
              <dl>
                {quote.items.map((it) => (
                  <div key={it.label}>
                    <dt>{it.label}</dt>
                    <dd>{usd.format(it.value)}</dd>
                  </div>
                ))}
                <div className="subtotal">
                  <dt>Subtotal per part</dt>
                  <dd>{usd.format(quote.items.reduce((s, it) => s + it.value, 0))}</dd>
                </div>
                {quote.multipliers.map((m) => (
                  <div key={m.label}>
                    <dt>{m.label}</dt>
                    <dd>× {m.value}</dd>
                  </div>
                ))}
              </dl>
              <ul>
                {quote.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ServiceQuote({ geometry }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [prodId, setProdId] = useState<string>(PRODUCTION_TIMES[0].id);
  const [slaResin, setSlaResin] = useState(SLA.resins[0].id);
  const [slaLayer, setSlaLayer] = useState(SLA.defaultLayer);
  const [pjMat, setPjMat] = useState(POLYJET.materials[0].id);
  const [fdmMat, setFdmMat] = useState(FDM.materials[0].id);
  const [useMinimum, setUseMinimum] = useState(false);

  const productionTime = PRODUCTION_TIMES.find((p) => p.id === prodId)!.factor;
  const qty = Math.max(1, Math.floor(quantity) || 1);

  const quotes = useMemo(() => {
    if (!geometry || geometry.volume <= 0) return null;
    const input: QuoteInput = { ...geometry, quantity: qty, productionTime };
    const min = (q: Quote) => (useMinimum ? applyMinimum(q, qty) : q);
    return {
      sla: min(quoteSLA(input, SLA.resins.find((r) => r.id === slaResin)!.costPerMm3, slaLayer)),
      polyjet: min(quotePolyJet(input, POLYJET.materials.find((m) => m.id === pjMat)!.costPerMm3)),
      fdm: min(quoteFDM(input, FDM.materials.find((m) => m.id === fdmMat)!)),
    };
  }, [geometry, qty, productionTime, slaResin, slaLayer, pjMat, fdmMat, useMinimum]);

  return (
    <section className="panel quotes">
      <div className="results-head">
        <h2>Service quote</h2>
        <span className="muted">AMFG simplified pricing logic</span>
      </div>
      <div className="quote-globals">
        <label>
          <span>Quantity</span>
          <input type="number" min={1} step={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        </label>
        <label>
          <span>Production time</span>
          <select value={prodId} onChange={(e) => setProdId(e.target.value)}>
            {PRODUCTION_TIMES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} (×{p.factor})
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={useMinimum} onChange={(e) => setUseMinimum(e.target.checked)} />
          <span>Apply ${MINIMUM_ORDER} minimum order</span>
        </label>
      </div>
      <div className="quote-grid">
        <QuoteCard title="SLA" subtitle="Stereolithography" quote={quotes?.sla ?? null} quantity={qty}>
          <select value={slaResin} onChange={(e) => setSlaResin(e.target.value)} aria-label="SLA resin">
            {SLA.resins.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <select value={slaLayer} onChange={(e) => setSlaLayer(Number(e.target.value))} aria-label="SLA layer height">
            {SLA.layerHeights.map((l) => (
              <option key={l} value={l}>
                {l} mm layers
              </option>
            ))}
          </select>
        </QuoteCard>
        <QuoteCard title="PolyJet" subtitle="Material jetting" quote={quotes?.polyjet ?? null} quantity={qty}>
          <select value={pjMat} onChange={(e) => setPjMat(e.target.value)} aria-label="PolyJet material">
            {POLYJET.materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </QuoteCard>
        <QuoteCard title="FDM" subtitle="Fused deposition" quote={quotes?.fdm ?? null} quantity={qty}>
          <select value={fdmMat} onChange={(e) => setFdmMat(e.target.value)} aria-label="FDM material">
            {FDM.materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </QuoteCard>
      </div>
      <p className="hint">
        {geometry
          ? `Totals are for the whole order${useMinimum ? "" : ", before any minimum order charge"}. PolyJet support volume is estimated from the model, not taken from a slicer.`
          : "Load a model to get SLA, PolyJet and FDM quotes."}
      </p>
    </section>
  );
}
