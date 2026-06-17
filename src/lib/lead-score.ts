/**
 * Lead Scoring — semáforo de calidad de cliente
 * El score se acumula por gestión según el RESULTADO seleccionado.
 * Umbrales:
 *   🟢 Caliente  : score ≥ 8
 *   🟡 Tibio     : score 1–7
 *   ⚪ Neutro    : score = 0
 *   🔴 Frío      : score < 0
 */

export type ScoreCategory = "caliente" | "tibio" | "neutro" | "frio";

export interface LeadScoreInfo {
  category: ScoreCategory;
  emoji: string;
  label: string;
  score: number;
}

export function getLeadScoreInfo(score: number): LeadScoreInfo {
  if (score >= 8) return { category: "caliente", emoji: "🟢", label: "Caliente", score };
  if (score >= 1) return { category: "tibio",    emoji: "🟡", label: "Tibio",    score };
  if (score >= 0) return { category: "neutro",   emoji: "⚪", label: "Neutro",   score };
  return              { category: "frio",         emoji: "🔴", label: "Frío",     score };
}

/** Clases para fondos claros (lista de clientes) */
export function scoreClasses(category: ScoreCategory): { bg: string; text: string } {
  switch (category) {
    case "caliente": return { bg: "bg-green-100 dark:bg-green-900/30",  text: "text-green-700 dark:text-green-400" };
    case "tibio":    return { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400" };
    case "neutro":   return { bg: "bg-gray-100 dark:bg-gray-800",        text: "text-gray-500 dark:text-gray-400" };
    case "frio":     return { bg: "bg-red-100 dark:bg-red-900/30",       text: "text-red-700 dark:text-red-400" };
  }
}

/** Clases para header oscuro (detalle del cliente) */
export function scoreHeaderClasses(category: ScoreCategory): { bg: string; text: string } {
  switch (category) {
    case "caliente": return { bg: "bg-green-400/30",  text: "text-green-100" };
    case "tibio":    return { bg: "bg-yellow-400/30", text: "text-yellow-100" };
    case "neutro":   return { bg: "bg-white/15",      text: "text-white/70" };
    case "frio":     return { bg: "bg-red-400/30",    text: "text-red-100" };
  }
}
