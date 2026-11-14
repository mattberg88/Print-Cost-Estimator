/**
 * Service-bureau quote formulas from "AMFG Quote Logic", pages 1–3
 * (SLA / PolyJet / FDM Simplified Pricing Logic).
 *
 * Units: volume mm³, surface area mm², lengths mm. Prices are per part;
 * the order total is per-part × quantity (then FDM minimums apply).
 */

export interface QuoteInput {
  volume: number; // mm³
  area: number; // mm²
  size: { x: number; y: number; z: number }; // mm
  supportVolume: number; // mm³, estimated with the part laid at its lowest height
  quantity: number;
  productionTime: number; // multiplier
}

export interface LineItem {
  label: string;
  value: number;
}

export interface Quote {
  perPart: number;
  total: number;
  items: LineItem[]; // pre-multiplier subtotal parts
  multipliers: LineItem[];
  notes: string[];
}

/** Shop-wide minimum order price. Optional in the UI; off shows the raw formula price. */
export const MINIMUM_ORDER = 200;

export function applyMinimum(q: Quote, quantity: number): Quote {
  if (q.total >= MINIMUM_ORDER) return q;
  return {
    ...q,
    total: MINIMUM_ORDER,
    perPart: MINIMUM_ORDER / quantity,
    notes: [...q.notes, `Raised from $${q.total.toFixed(2)} to the $${MINIMUM_ORDER} minimum order`],
  };
}

export const PRODUCTION_TIMES = [
  { id: "standard", label: "Standard (2–3 days)", factor: 1 },
  { id: "next-day", label: "Next day", factor: 1.5 },
  { id: "same-day", label: "Same day", factor: 2 },
] as const;

// ---------- SLA (page 1) ----------
export const SLA = {
  markup: 1.75,
  setup: 53.51,
  heightFactor: 0.007,
  rate: 3.3,
  sparseRatio: 50,
  sparseFactor: 1.3,
  layerHeights: [0.025, 0.05, 0.1],
  defaultLayer: 0.05,
  resins: [
    { id: "standard-rigid", label: "Standard rigid", costPerMm3: 0.000174 },
    { id: "engineering", label: "Engineering resin", costPerMm3: 0.0002 },
    { id: "wax-40", label: "Wax 40", costPerMm3: 0.000282 },
  ],
};

export function quoteSLA(i: QuoteInput, resinCostPerMm3: number, layerHeight: number): Quote {
  const setup = SLA.setup / i.quantity;
  const resin = i.volume * resinCostPerMm3;
  const maxDim = Math.max(i.size.x, i.size.y, i.size.z);
  const buildTime = (maxDim / layerHeight) * SLA.heightFactor * SLA.rate;
  const bboxRatio = (i.size.x * i.size.y * i.size.z) / i.volume;
  const sparse = bboxRatio > SLA.sparseRatio ? SLA.sparseFactor : 1;
  const perPart = SLA.markup * i.productionTime * (setup + resin + buildTime) * sparse;
  return {
    perPart,
    total: perPart * i.quantity,
    items: [
      { label: "Setup", value: setup },
      { label: "Resin", value: resin },
      { label: "Build time", value: buildTime },
    ],
    multipliers: [
      { label: "Markup", value: SLA.markup },
      { label: "Production time", value: i.productionTime },
      { label: sparse > 1 ? "Sparse part" : "Not sparse", value: sparse },
    ],
    notes: [
      `${Math.round(maxDim / layerHeight).toLocaleString()} layers (longest side ${maxDim.toFixed(1)} mm ÷ ${layerHeight} mm)`,
      `Bounding box is ${bboxRatio.toFixed(1)}× the part volume (sparse if > ${SLA.sparseRatio})`,
    ],
  };
}

// ---------- PolyJet (page 2) ----------
export const POLYJET = {
  markup: 2,
  setup: 62.05,
  resinModifier: 1.3,
  supportModifier: 0.4,
  supportCost: 0.000215,
  layerHeight: 0.016, // 16 microns (confirmed; page 2 says 0.0016, a typo)
  heightFactor: 0.002,
  rate: 20.61,
  smallPartVolume: 70000,
  smallPartFactor: 0.7,
  materials: [
    { id: "verowhiteplus", label: "VeroWhitePlus", costPerMm3: 0.000472 },
    { id: "veroclear", label: "VeroClear", costPerMm3: 0.000569 },
    { id: "veroblack", label: "VeroBlack", costPerMm3: 0.00048 },
    { id: "tangoblackplus", label: "TangoBlackPlus", costPerMm3: 0.000541 },
  ],
};

export function quotePolyJet(i: QuoteInput, resinCostPerMm3: number): Quote {
  const setup = POLYJET.setup / i.quantity;
  const resin = POLYJET.resinModifier * i.volume * resinCostPerMm3;
  const support = POLYJET.supportModifier * i.supportVolume * POLYJET.supportCost;
  const minDim = Math.min(i.size.x, i.size.y, i.size.z);
  const buildTime = (minDim / POLYJET.layerHeight) * POLYJET.heightFactor * POLYJET.rate;
  const small = i.volume < POLYJET.smallPartVolume ? POLYJET.smallPartFactor : 1;
  const perPart = POLYJET.markup * i.productionTime * (setup + resin + support + buildTime) * small;
  return {
    perPart,
    total: perPart * i.quantity,
    items: [
      { label: "Setup", value: setup },
      { label: "Resin", value: resin },
      { label: "Support", value: support },
      { label: "Build time", value: buildTime },
    ],
    multipliers: [
      { label: "Markup", value: POLYJET.markup },
      { label: "Production time", value: i.productionTime },
      { label: small < 1 ? "Small part" : "Not a small part", value: small },
    ],
    notes: [
      `${Math.round(minDim / POLYJET.layerHeight).toLocaleString()} layers (shortest side ${minDim.toFixed(1)} mm ÷ ${POLYJET.layerHeight} mm)`,
      `Support volume ≈ ${(i.supportVolume / 1000).toFixed(1)} cm³ (estimated, part laid at its lowest height)`,
    ],
  };
}

// ---------- FDM (page 3) ----------
export const FDM = {
  markup: 2,
  setup: 41.25,
  infill: 0.3,
  skinFactor: 10,
  supportModifier: 0.3,
  supportCostPerCm3: 0.178,
  rate: 4.45,
  materials: [
    { id: "abs-m30", label: "ABS-M30", costPerCm3: 0.158, timeFactor: 0.009 },
    { id: "tpu-92a", label: "TPU-92A Black", costPerCm3: 0.219, timeFactor: 0.018 },
  ],
};

export function quoteFDM(i: QuoteInput, material: (typeof FDM.materials)[number]): Quote {
  const setup = FDM.setup / i.quantity;
  const volCm3 = i.volume / 1000;
  const areaCm2 = i.area / 100;
  // Skin: surface area (cm²) ÷ 10 ≈ a 1 mm shell in cm³.
  const resin = material.costPerCm3 * (volCm3 * FDM.infill + areaCm2 / FDM.skinFactor);
  const support = FDM.supportModifier * volCm3 * FDM.supportCostPerCm3;
  const buildTime = areaCm2 * material.timeFactor * FDM.rate;
  const perPart = FDM.markup * i.productionTime * (setup + resin + support + buildTime);
  const notes = [`Surface area ${areaCm2.toFixed(1)} cm², volume ${volCm3.toFixed(1)} cm³`];
  return {
    perPart,
    total: perPart * i.quantity,
    items: [
      { label: "Setup", value: setup },
      { label: "Material", value: resin },
      { label: "Support", value: support },
      { label: "Build time", value: buildTime },
    ],
    multipliers: [
      { label: "Markup", value: FDM.markup },
      { label: "Production time", value: i.productionTime },
    ],
    notes,
  };
}
