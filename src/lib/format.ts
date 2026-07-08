/**
 * format.ts — Utilidades de formato y tipos de instancia para SGP Field Connect.
 * Reemplaza mock-data.ts: elimina datos de prueba, conserva solo los formatters reales.
 */

// ── Instancias (pipeline del cliente) ───────────────────────────────────────

export type StageKey =
  | "censo"
  | "contacto"
  | "presentacion"
  | "negociacion"
  | "cierre"
  | "contrato"
  | "pago"
  | "renovacion"
  | "baja";

export interface Stage {
  key: StageKey;
  num: number;
  label: string;
  short: string;
  color: string;
  text: string;
}

export const STAGES: Stage[] = [
  { key: "censo",        num: 1, label: "Censo",           short: "CENSO",    color: "bg-stage-censo",        text: "text-stage-censo" },
  { key: "contacto",     num: 2, label: "Primer Contacto", short: "CONTACTO", color: "bg-stage-contacto",     text: "text-stage-contacto" },
  { key: "presentacion", num: 3, label: "Presentación",    short: "PRESENT.", color: "bg-stage-presentacion", text: "text-stage-presentacion" },
  { key: "negociacion",  num: 4, label: "Negociación",     short: "NEGOC.",   color: "bg-stage-negociacion",  text: "text-stage-negociacion" },
  { key: "cierre",       num: 5, label: "Cierre",          short: "CIERRE",   color: "bg-stage-cierre",       text: "text-stage-cierre" },
  { key: "contrato",     num: 6, label: "Contrato",        short: "CONTRATO", color: "bg-stage-contrato",     text: "text-stage-contrato" },
  { key: "pago",         num: 7, label: "Pago",            short: "PAGO",     color: "bg-stage-pago",         text: "text-stage-pago" },
  { key: "renovacion",   num: 8, label: "Renovación",      short: "RENOV.",   color: "bg-stage-renovacion",   text: "text-stage-renovacion" },
  { key: "baja",         num: 9, label: "Baja",            short: "BAJA",     color: "bg-stage-baja",         text: "text-stage-baja" },
];

export const stageByKey = (k: StageKey) => STAGES.find((s) => s.key === k)!;

// ── Formatters de moneda y fecha ─────────────────────────────────────────────

/** Formatea un número como guaraníes: 1500000 → "₲ 1.500.000" */
export const formatPYG = (n: number) =>
  new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 }).format(n);

/**
 * Parsea un monto entero en PYG ingresado por el usuario.
 * Acepta separadores de miles: "150.000" → 150000, "1.500.000" → 1500000
 * Rechaza decimales: "150,5" → null (coma decimal no válida en PYG)
 * Rechaza texto o vacío → null
 */
export function parseMontoPYG(value: string | null | undefined): number | null {
  if (!value) return null;
  const limpio = value.replace(/[\s.]/g, "").trim();
  if (!limpio) return null;
  if (!/^\d+$/.test(limpio)) return null;
  const n = parseInt(limpio, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

/** Formatea una fecha ISO como "08 jul. 2026" */
export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("es-PY", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

/** Devuelve "Hoy", "Ayer", "Hace N días", "Hace N sem." o la fecha formateada */
export const relativeDate = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem.`;
  return formatDate(iso);
};
