import {
  MINIMUM_ORDER,
  TURNAROUNDS,
  type Breakdown,
  type LineQuote,
  type OrderPricing,
  type OrderRequest,
  type ProcessId,
  type QuoteResponse,
  type TurnaroundId,
} from "./options";
import { FDM, POLYJET, PRODUCTION_TIMES, SLA, quoteFDM, quotePolyJet, quoteSLA, type Quote, type QuoteInput } from "./quote";

/**
 * Server-side pricing for an order of one or more parts, each with its own process and material.
 * Each part is priced on its own with the AMFG formulas (setup spread over that part's quantity),
 * lines are summed, then the $200 minimum applies to the order. Every turnaround option is priced
 * so the page can show them side by side.
 */

const MAX_PARTS = 50;
const PROCESSES: ProcessId[] = ["sla", "polyjet", "fdm"];

const num = (v: unknown, min = 0, max = 1e12) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

const item = (q: Quote, ...labels: string[]) => q.items.find((i) => labels.includes(i.label))?.value ?? 0;

function priceOne(process: ProcessId, material: string, slaLayer: number | undefined, input: QuoteInput): Quote {
  if (process === "sla") {
    const r = SLA.resins.find((x) => x.id === material) ?? SLA.resins[0];
    const layer = SLA.layerHeights.includes(Number(slaLayer)) ? Number(slaLayer) : SLA.defaultLayer;
    return quoteSLA(input, r.costPerMm3, layer);
  }
  if (process === "polyjet") {
    const m = POLYJET.materials.find((x) => x.id === material) ?? POLYJET.materials[0];
    return quotePolyJet(input, m.costPerMm3);
  }
  const m = FDM.materials.find((x) => x.id === material) ?? FDM.materials[0];
  return quoteFDM(input, m);
}

const emptyBreakdown = (): Breakdown => ({ setup: 0, material: 0, support: 0, buildTime: 0, markup: 0, markupFactor: 1, minimumAdjustment: 0 });

export function computeOrder(body: Partial<OrderRequest>, admin: boolean): QuoteResponse | { error: string } {
  const raw = Array.isArray(body.parts) ? body.parts.slice(0, MAX_PARTS) : [];
  const parts = raw.flatMap((p) => {
    const volume = num(p?.volume, 1e-9);
    const area = num(p?.area, 1e-9);
    const sx = num(p?.size?.x), sy = num(p?.size?.y), sz = num(p?.size?.z);
    if (volume === null || area === null || sx === null || sy === null || sz === null) return [];
    const process: ProcessId = PROCESSES.includes(p.process as ProcessId) ? (p.process as ProcessId) : "sla";
    return [
      {
        id: String(p.id ?? "").slice(0, 80),
        process,
        material: String(p.material ?? ""),
        slaLayer: p.slaLayer,
        input: {
          volume,
          area,
          size: { x: sx, y: sy, z: sz },
          supportVolume: num(p.supportVolume) ?? 0,
          quantity: Math.floor(num(p.quantity, 1, 100000) ?? 1),
        },
      },
    ];
  });
  if (!parts.length) return { error: "Add at least one valid part" };

  const options = {} as Record<TurnaroundId, OrderPricing>;
  for (const t of TURNAROUNDS) {
    const factor = PRODUCTION_TIMES.find((x) => x.id === t.id)?.factor ?? 1;
    const order = emptyBreakdown();
    let orderBase = 0;
    const lines: LineQuote[] = parts.map((p) => {
      const q = priceOne(p.process, p.material, p.slaLayer, { ...p.input, productionTime: factor });
      const n = p.input.quantity;
      const base = q.items.reduce((s, x) => s + x.value, 0) * n;
      const total = q.perPart * n;
      const line: LineQuote = { id: p.id, total, perPart: q.perPart };
      if (admin) {
        line.breakdown = {
          setup: item(q, "Setup") * n,
          material: item(q, "Material", "Resin") * n,
          support: item(q, "Support") * n,
          buildTime: item(q, "Build time") * n,
          markup: total - base,
          markupFactor: base > 0 ? total / base : 1,
          minimumAdjustment: 0,
        };
        for (const k of ["setup", "material", "support", "buildTime", "markup"] as const) order[k] += line.breakdown[k];
      }
      orderBase += base;
      return line;
    });
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const minimumApplied = subtotal < MINIMUM_ORDER;
    const total = minimumApplied ? MINIMUM_ORDER : subtotal;
    const pricing: OrderPricing = { total, subtotal, minimumApplied, lines };
    if (admin) {
      order.markupFactor = orderBase > 0 ? subtotal / orderBase : 1;
      order.minimumAdjustment = total - subtotal;
      pricing.breakdown = order;
    }
    options[t.id] = pricing;
  }
  return { admin, options };
}
