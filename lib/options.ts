/**
 * Client-safe quote options: ids and labels only. No prices or formula
 * constants live here; those stay on the server in lib/quote.ts.
 */

export const MINIMUM_ORDER = 200;

export const TURNAROUNDS = [
  { id: "standard", label: "Standard", note: "Ships in 2–3 business days" },
  { id: "next-day", label: "Next day", note: "Ships next business day" },
  { id: "same-day", label: "Same day", note: "Ships today" },
] as const;

export const SLA_RESINS = [
  { id: "standard-rigid", label: "Standard rigid" },
  { id: "engineering", label: "Engineering resin" },
  { id: "wax-40", label: "Wax 40" },
] as const;

export const SLA_LAYERS = [0.025, 0.05, 0.1] as const;
export const SLA_DEFAULT_LAYER = 0.05;
export const POLYJET_LAYER = 0.016;

export const POLYJET_MATERIALS = [
  { id: "verowhiteplus", label: "VeroWhitePlus" },
  { id: "veroclear", label: "VeroClear" },
  { id: "veroblack", label: "VeroBlack" },
  { id: "tangoblackplus", label: "TangoBlackPlus" },
] as const;

export const FDM_MATERIALS = [
  { id: "abs-m30", label: "ABS-M30" },
  { id: "tpu-92a", label: "TPU-92A Black" },
] as const;

export type ProcessId = "sla" | "polyjet" | "fdm";

export type TurnaroundId = (typeof TURNAROUNDS)[number]["id"];

export interface PartRequest {
  id: string;
  volume: number; // mm³
  area: number; // mm²
  size: { x: number; y: number; z: number }; // mm
  supportVolume: number; // mm³
  quantity: number;
  process: ProcessId;
  material: string; // id from the process's material list
  slaLayer?: number; // SLA only
}

export interface OrderRequest {
  parts: PartRequest[];
}

/** Dollar amounts for a line (per-part cost × quantity) or a whole order. Admin only. */
export interface Breakdown {
  setup: number;
  material: number;
  support: number;
  buildTime: number;
  markup: number; // dollars added by markup, turnaround and part adjustments
  markupFactor: number; // overall multiplier (subtotal ÷ base cost)
  minimumAdjustment: number; // dollars added to reach the minimum order (order level only)
}

export interface LineQuote {
  id: string;
  total: number; // this part × its quantity, before the order minimum
  perPart: number;
  breakdown?: Breakdown; // admin only
}

export interface OrderPricing {
  total: number; // including the minimum
  subtotal: number; // sum of lines, before the minimum
  minimumApplied: boolean;
  lines: LineQuote[];
  breakdown?: Breakdown; // admin only
}

export interface QuoteResponse {
  admin: boolean;
  options: Record<TurnaroundId, OrderPricing>;
}

export const MATERIALS: Record<ProcessId, readonly { id: string; label: string }[]> = {
  sla: SLA_RESINS,
  polyjet: POLYJET_MATERIALS,
  fdm: FDM_MATERIALS,
};

export const PROCESS_INFO: Record<ProcessId, { name: string; full: string; blurb: string }> = {
  sla: { name: "SLA", full: "Stereolithography (SLA)", blurb: "Smooth surfaces and fine detail" },
  polyjet: { name: "PolyJet", full: "PolyJet", blurb: "Very fine layers, multi-material" },
  fdm: { name: "FDM", full: "Fused Deposition Modeling (FDM)", blurb: "Strong, economical parts" },
};
