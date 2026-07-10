import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { addBusinessHours } from "@/lib/utils-field";

/**
 * Total de alertas vencidas (visitas + contactos) para el badge de la campanita.
 * Misma lógica que Inicio.tsx / Alertas.tsx. Cachea 10 min en localStorage
 * porque el AppHeader se monta en todas las páginas.
 */

const CACHE_KEY = "sgp-alertas-badge";
const TTL_MS = 10 * 60 * 1000;

export function useAlertasBadge(): number {
  const { user } = useAuth();
  const { canManage, loading } = useProfile();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!user || loading) return;

    // Cache con TTL para no repetir la query en cada navegación
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { t, total: tot, uid } = JSON.parse(raw);
        if (uid === user.id && Date.now() - t < TTL_MS) {
          setTotal(tot);
          return;
        }
      }
    } catch { /* cache corrupto: recalcular */ }

    const calcular = async () => {
      let qClientes = supabase
        .from("clientes")
        .select("id, rubro_rel:rubro_id(dias_visita)")
        .eq("activo", true)
        .not("instancia", "eq", "CENSO");
      if (!canManage) qClientes = qClientes.eq("ejecutivo_id", user.id);

      const { data: clientes } = await qClientes;
      if (!clientes || clientes.length === 0) { setTotal(0); return; }

      const hace30 = new Date();
      hace30.setDate(hace30.getDate() - 30);

      let qGestiones = supabase
        .from("gestiones")
        .select("id, cliente_id, tipo, created_at, clientes!inner(ejecutivo_id, instancia, activo)")
        .eq("clientes.activo", true)
        .not("clientes.instancia", "eq", "CENSO")
        .gte("created_at", hace30.toISOString())
        .order("created_at", { ascending: true });
      if (!canManage) qGestiones = qGestiones.eq("clientes.ejecutivo_id", user.id);

      const { data: gestiones } = await qGestiones;
      const arr = gestiones ?? [];
      const ahora = new Date();
      let vencidas = 0;

      for (const c of clientes) {
        const diasVisita = (c.rubro_rel as unknown as { dias_visita: number | null } | null)?.dias_visita ?? 7;

        // Visita vencida
        const visitas = arr
          .filter((g) => g.cliente_id === c.id && g.tipo === "visita")
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const diasDesde = visitas.length === 0
          ? 30
          : (ahora.getTime() - new Date(visitas[0].created_at).getTime()) / 86_400_000;
        if (diasDesde > diasVisita) vencidas++;

        // Contacto vencido: visita sin seguimiento en 24h hábiles
        const recientes = arr.filter(
          (g) => g.cliente_id === c.id && g.tipo === "visita" &&
            ahora.getTime() - new Date(g.created_at).getTime() < 10 * 86_400_000
        );
        for (const visita of recientes) {
          const fecha = new Date(visita.created_at);
          const deadline = addBusinessHours(fecha, 24);
          if (ahora > deadline) {
            const tieneContacto = arr.some(
              (g) =>
                g.cliente_id === c.id &&
                g.tipo !== "visita" &&
                new Date(g.created_at) > fecha &&
                new Date(g.created_at) <= deadline
            );
            if (!tieneContacto) { vencidas++; break; }
          }
        }
      }

      setTotal(vencidas);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), total: vencidas, uid: user.id }));
      } catch { /* cache lleno: ignorar */ }
    };

    calcular();
  }, [user, loading, canManage]);

  return total;
}
