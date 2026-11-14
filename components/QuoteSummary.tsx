"use client";

import { useState } from "react";
import { MINIMUM_ORDER, TURNAROUNDS, type OrderPricing, type TurnaroundId } from "@/lib/options";
import { BreakdownList, type QuotePart } from "./PartCard";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

interface Props {
  parts: QuotePart[];
  options: Record<TurnaroundId, OrderPricing> | null;
  turnaround: TurnaroundId;
  onTurnaround: (t: TurnaroundId) => void;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
}

export default function QuoteSummary({ parts, options, turnaround, onTurnaround, loading, error, isAdmin }: Props) {
  const [showBd, setShowBd] = useState(true);
  const sel = options?.[turnaround] ?? null;
  const pieces = parts.reduce((s, p) => s + Math.max(1, Math.floor(p.quantity) || 1), 0);
  const cheapest = options
    ? (TURNAROUNDS.map((t) => t.id) as TurnaroundId[]).reduce((a, b) => (options[a].total <= options[b].total ? a : b))
    : null;

  return (
    <aside className="summary" aria-label="Quote summary">
      <div className="summary-card">
        <div className="field-label">Lead time</div>
        <div className={`sum-options ${loading ? "is-loading" : ""}`} role="radiogroup" aria-label="Lead time">
          {TURNAROUNDS.map((t) => {
            const o = options?.[t.id];
            const on = t.id === turnaround;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`sum-opt ${on ? "on" : ""}`}
                onClick={() => onTurnaround(t.id)}
              >
                <span className="sum-opt-top">
                  <span className="sum-opt-name">{t.label}</span>
                  {cheapest === t.id && <span className="tag">Lowest price</span>}
                </span>
                <span className="sum-opt-note">{t.note}</span>
                <span className="sum-opt-price">{o ? usd.format(o.total) : "—"}</span>
              </button>
            );
          })}
        </div>

        <dl className="sum-lines">
          <div>
            <dt>
              Parts ({parts.length} {parts.length === 1 ? "design" : "designs"}, {pieces} {pieces === 1 ? "piece" : "pieces"})
            </dt>
            <dd>{sel ? usd.format(sel.subtotal) : "—"}</dd>
          </div>
          {sel?.minimumApplied && (
            <div>
              <dt>Minimum order adjustment</dt>
              <dd>{usd.format(sel.total - sel.subtotal)}</dd>
            </div>
          )}
          <div className="sum-total">
            <dt>Estimated total</dt>
            <dd className={loading ? "dim" : ""}>{sel ? usd.format(sel.total) : "—"}</dd>
          </div>
        </dl>

        <a className="btn-primary wide" href="https://www.artifactory3d.com/contact/">
          Request this quote
        </a>
        <p className="fine">
          {error ?? `Includes a $${MINIMUM_ORDER} minimum order. Estimates only; final pricing is confirmed when you order.`}
        </p>
      </div>

      {isAdmin && sel?.breakdown && (
        <div className="summary-card admin-card">
          <button type="button" className="admin-toggle" onClick={() => setShowBd((v) => !v)} aria-expanded={showBd}>
            <span className="admin-badge">Admin</span> Order cost breakdown
            <span className="chev">{showBd ? "−" : "+"}</span>
          </button>
          {showBd && <BreakdownList b={sel.breakdown} total={sel.total} label="Order total" />}
        </div>
      )}
    </aside>
  );
}
