import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { MINIMUM_ORDER, type ProcessId, type ProcessQuote, type QuoteRequest, type QuoteResponse } from "@/lib/options";
import { FDM, POLYJET, PRODUCTION_TIMES, SLA, quoteFDM, quotePolyJet, quoteSLA, type Quote, type QuoteInput } from "@/lib/quote";

export const dynamic = "force-dynamic";

const num = (v: unknown, min = 0, max = 1e12) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

function finish(q: Quote, quantity: number, admin: boolean): ProcessQuote {
  const base = q.items.reduce((s, x) => s + x.value, 0);
  const minimumApplied = q.total < MINIMUM_ORDER;
  const total = minimumApplied ? MINIMUM_ORDER : q.total;
  const perPart = total / quantity;
  const out: ProcessQuote = { total, perPart, minimumApplied };
  if (admin) {
    const get = (...labels: string[]) => q.items.find((i) => labels.includes(i.label))?.value ?? null;
    out.breakdown = {
      setup: get("Setup"),
      material: get("Material", "Resin"),
      support: get("Support"),
      buildTime: get("Build time"),
      markup: q.perPart - base,
      markupFactor: base > 0 ? q.perPart / base : 1,
      minimumAdjustment: perPart - q.perPart,
    };
  }
  return out;
}

export async function POST(req: NextRequest) {
  let body: Partial<QuoteRequest>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const volume = num(body.volume, 1e-9);
  const area = num(body.area, 1e-9);
  const support = num(body.supportVolume) ?? 0;
  const sx = num(body.size?.x), sy = num(body.size?.y), sz = num(body.size?.z);
  const quantity = Math.floor(num(body.quantity, 1, 100000) ?? 1);
  if (volume === null || area === null || sx === null || sy === null || sz === null) {
    return NextResponse.json({ error: "Invalid model measurements" }, { status: 400 });
  }

  const turnaround = PRODUCTION_TIMES.find((p) => p.id === body.turnaround) ?? PRODUCTION_TIMES[0];
  const slaResin = SLA.resins.find((r) => r.id === body.slaResin) ?? SLA.resins[0];
  const slaLayer = SLA.layerHeights.includes(Number(body.slaLayer)) ? Number(body.slaLayer) : SLA.defaultLayer;
  const pjMat = POLYJET.materials.find((m) => m.id === body.polyjetMaterial) ?? POLYJET.materials[0];
  const fdmMat = FDM.materials.find((m) => m.id === body.fdmMaterial) ?? FDM.materials[0];

  const input: QuoteInput = {
    volume,
    area,
    size: { x: sx, y: sy, z: sz },
    supportVolume: support,
    quantity,
    productionTime: turnaround.factor,
  };

  const admin = isAdmin(req);
  const quotes: Record<ProcessId, ProcessQuote> = {
    sla: finish(quoteSLA(input, slaResin.costPerMm3, slaLayer), quantity, admin),
    polyjet: finish(quotePolyJet(input, pjMat.costPerMm3), quantity, admin),
    fdm: finish(quoteFDM(input, fdmMat), quantity, admin),
  };

  const res: QuoteResponse = { admin, quotes };
  return NextResponse.json(res, { headers: { "Cache-Control": "no-store" } });
}
