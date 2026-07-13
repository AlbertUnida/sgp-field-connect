import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Tracking de ubicación en segundo plano (mientras la app está abierta).
 * Reporta a `ubicaciones_ejecutivos` (1 fila por usuario, upsert) para el
 * mapa de Monitoreo en vivo. Sin señal GPS o sin permiso → falla en silencio.
 *
 * Throttle: envía solo si pasaron 90s O se movió más de 150m,
 * para cuidar batería y cuota de Supabase.
 */

const MIN_INTERVALO_MS = 90_000;
const MIN_DISTANCIA_M = 150;

function distanciaM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function useTracking() {
  const { user } = useAuth();
  const ultimo = useRef<{ lat: number; lng: number; t: number } | null>(null);

  useEffect(() => {
    if (!user || !("geolocation" in navigator)) return;

    const enviar = (pos: GeolocationPosition) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const ahora = Date.now();
      const prev = ultimo.current;
      if (prev && ahora - prev.t < MIN_INTERVALO_MS && distanciaM(prev, { lat, lng }) < MIN_DISTANCIA_M) {
        return;
      }
      ultimo.current = { lat, lng, t: ahora };
      supabase
        .from("ubicaciones_ejecutivos")
        .upsert({
          ejecutivo_id: user.id,
          lat,
          lng,
          accuracy: accuracy ?? null,
          updated_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) console.warn("Tracking: no se pudo reportar ubicación:", error.message);
        });
      // Punto de recorrido histórico (acumulativo, para la polilínea de Monitoreo)
      supabase
        .from("ubicaciones_historial")
        .insert({ ejecutivo_id: user.id, lat, lng, accuracy: accuracy ?? null })
        .then(({ error }) => {
          if (error) console.warn("Tracking histórico:", error.message);
        });
    };

    const watchId = navigator.geolocation.watchPosition(enviar, () => {}, {
      enableHighAccuracy: false,
      maximumAge: 60_000,
      timeout: 30_000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user]);
}
