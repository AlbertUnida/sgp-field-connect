import { supabase } from "./supabaseClient";

/**
 * Fija `clientes.lat/lng` desde el GPS de una visita SOLO si el cliente todavía
 * no tiene ubicación cargada. El guard `.is("lat", null)` garantiza que nunca se
 * pisa una ubicación existente (regla CLAUDE.md), incluso ante concurrencia.
 * Silencioso: si falla (RLS/red) no interrumpe el flujo de la gestión.
 */
export async function fijarUbicacionSiFalta(
  clienteId: number | string,
  lat: number | null | undefined,
  lng: number | null | undefined
): Promise<void> {
  if (lat == null || lng == null) return;
  try {
    await supabase
      .from("clientes")
      .update({ lat, lng })
      .eq("id", clienteId)
      .is("lat", null);
  } catch {
    /* no bloquear el registro de la gestión por esto */
  }
}
