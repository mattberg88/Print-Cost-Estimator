export type Unit = "mm" | "cm" | "m" | "in";
export const UNIT_TO_MM: Record<Unit, number> = { mm: 1, cm: 10, m: 1000, in: 25.4 };
