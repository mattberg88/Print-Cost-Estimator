export type PriceUnit = "kg" | "L";

export interface Printer {
  id: string;
  brand: string;
  model: string;
  tech: "mSLA" | "SLA";
  /** Build volume in mm: x (width) × y (depth) × z (height). */
  build: { x: number; y: number; z: number };
  /** Default resin used for the estimate. Price is editable in the UI. */
  resin: { name: string; price: number; unit: PriceUnit };
  /** Rough real-world vertical speed with standard resin, mm/hour. */
  speedMmPerHr: number;
}

/**
 * Defaults are approximate list prices / specs as of late 2026.
 * Resin prices move around a lot with sales; every price is editable in the UI.
 */
export const PRINTERS: Printer[] = [
  {
    id: "elegoo-saturn-4-ultra-16k",
    brand: "Elegoo",
    model: "Saturn 4 Ultra 16K",
    tech: "mSLA",
    build: { x: 211.7, y: 118.4, z: 220 },
    resin: { name: "Elegoo Standard", price: 28, unit: "kg" },
    speedMmPerHr: 30,
  },
  {
    id: "elegoo-mars-5-ultra",
    brand: "Elegoo",
    model: "Mars 5 Ultra",
    tech: "mSLA",
    build: { x: 153.4, y: 77.8, z: 165 },
    resin: { name: "Elegoo Standard", price: 28, unit: "kg" },
    speedMmPerHr: 30,
  },
  {
    id: "anycubic-photon-mono-m7-pro",
    brand: "Anycubic",
    model: "Photon Mono M7 Pro",
    tech: "mSLA",
    build: { x: 223, y: 126, z: 230 },
    resin: { name: "Anycubic Standard", price: 32, unit: "kg" },
    speedMmPerHr: 35,
  },
  {
    id: "anycubic-photon-mono-m7-max",
    brand: "Anycubic",
    model: "Photon Mono M7 Max",
    tech: "mSLA",
    build: { x: 298, y: 164, z: 300 },
    resin: { name: "Anycubic Standard", price: 32, unit: "kg" },
    speedMmPerHr: 30,
  },
  {
    id: "phrozen-sonic-mighty-revo",
    brand: "Phrozen",
    model: "Sonic Mighty Revo",
    tech: "mSLA",
    build: { x: 223, y: 126, z: 235 },
    resin: { name: "Phrozen Aqua 4K", price: 35, unit: "kg" },
    speedMmPerHr: 40,
  },
  {
    id: "creality-halot-mage-s",
    brand: "Creality",
    model: "HALOT-MAGE S 14K",
    tech: "mSLA",
    build: { x: 223, y: 126, z: 230 },
    resin: { name: "Creality Standard", price: 25, unit: "kg" },
    speedMmPerHr: 35,
  },
  {
    id: "prusa-sl1s-speed",
    brand: "Prusa",
    model: "SL1S Speed",
    tech: "mSLA",
    build: { x: 127, y: 80, z: 150 },
    resin: { name: "Prusament Resin", price: 40, unit: "kg" },
    speedMmPerHr: 25,
  },
  {
    id: "formlabs-form-4",
    brand: "Formlabs",
    model: "Form 4",
    tech: "SLA",
    build: { x: 200, y: 125, z: 210 },
    resin: { name: "Formlabs Standard (V5)", price: 149, unit: "L" },
    speedMmPerHr: 40,
  },
];

export type Unit = "mm" | "cm" | "m" | "in";
export const UNIT_TO_MM: Record<Unit, number> = { mm: 1, cm: 10, m: 1000, in: 25.4 };

export type FitResult = "fits" | "rotate" | "too-big";

/** Model size in mm, Y-up (x = width, y = height, z = depth). */
export function checkFit(size: { x: number; y: number; z: number }, b: Printer["build"]): FitResult {
  if (size.x <= b.x && size.z <= b.y && size.y <= b.z) return "fits";
  const m = [size.x, size.y, size.z].sort((a, c) => a - c);
  const p = [b.x, b.y, b.z].sort((a, c) => a - c);
  if (m[0] <= p[0] && m[1] <= p[1] && m[2] <= p[2]) return "rotate";
  return "too-big";
}

export interface Estimate {
  printer: Printer;
  price: number;
  resinMl: number;
  resinG: number;
  cost: number;
  hours: number;
  fit: FitResult;
}

export function estimate(
  printer: Printer,
  price: number,
  volumeMm3: number,
  sizeMm: { x: number; y: number; z: number },
  wastePct: number,
  densityGPerMl: number,
): Estimate {
  const resinMl = (volumeMm3 / 1000) * (1 + wastePct / 100);
  const resinG = resinMl * densityGPerMl;
  const cost = printer.resin.unit === "L" ? (resinMl / 1000) * price : (resinG / 1000) * price;
  // Resin printers cure a whole layer at once, so time depends on height, not volume.
  const hours = sizeMm.y / printer.speedMmPerHr;
  return { printer, price, resinMl, resinG, cost, hours, fit: checkFit(sizeMm, printer.build) };
}
