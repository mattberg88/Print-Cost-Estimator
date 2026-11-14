/**
 * Client-safe quote options: ids and labels only. No prices or formula
 * constants live here; those stay on the server in lib/quote.ts.
 */

export const MINIMUM_ORDER = 200;

export const TURNAROUNDS = [
  { id: "standard", label: "Standard", note: "2–3 days" },
  { id: "next-day", label: "Next day", note: "Rush" },
  { id: "same-day", label: "Same day", note: "Rush" },
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

export interface QuoteRequest {
  volume: number; // mm³
  area: number; // mm²
  size: { x: number; y: number; z: number }; // mm
  supportVolume: number; // mm³
  quantity: number;
  turnaround: string;
  slaResin: string;
  slaLayer: number;
  polyjetMaterial: string;
  fdmMaterial: string;
}

export interface Breakdown {
  setup: number | null;
  material: number | null;
  support: number | null;
  buildTime: number | null;
  markup: number; // dollars added by markup, turnaround and part adjustments (per part)
  markupFactor: number; // combined multiplier
  minimumAdjustment: number; // dollars added per part to reach the minimum order
}

export interface ProcessQuote {
  total: number;
  perPart: number;
  minimumApplied: boolean;
  breakdown?: Breakdown; // admin only
}

export interface QuoteResponse {
  admin: boolean;
  quotes: Record<ProcessId, ProcessQuote>;
}
