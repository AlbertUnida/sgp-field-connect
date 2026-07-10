import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Navigation, Loader2, RefreshCw, ChevronRight, CalendarClock } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { capturarGPSPromise, distanciaMetros } from "@/lib/utils-field";
import { cn } from "@/lib/utils";

/**
 * Ruta del día: clientes de la cartera propia con visita vencida (según
 * dias_visita del rubro) o próxima acción para hoy, ordenados por cercanía
 * a la posición actual del ejecutivo. La ubicación de cada cliente es el
 * centroide de sus visitas históricas con GPS (últimos 90 días).
 */

interface Parada {
  id: string;
  nombre: string;
  ciudad: string | null;
  telefono: string | null;
  diasDesde: number | null; // null = nunca visitado
  limite: number;
  proximaHoy: boolean;
  lat: number | null;
  lng: number | null;
}

const formatDist = (m: number) =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;

const RutaDia = () => {
  const { user } = useAuth();

  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsEstado, setGpsEstado] = useState<"buscando" | "ok" | "error">("buscando");
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [loading, setLoading] = useState(true);

  const obtenerGPS = useCallback(async () => {
    setGpsEstado("buscando");
    const p = await capturarGPSPromise();
    setPos(p);
    setGpsEstado(p ? "ok" : "error");
  }, []);

  useEffect(() => { obtenerGPS(); }, [obtenerGPS]);

  useEffect(() => {
    if (!user) return;
    const cargar = async () => {
      setLoading(true);

      const hoyStr = new Date().toISOString().split("T")[0];
      const hace90 = new Date();
      hace90.setDate(hace90.getDate() - 90);

      const [{ data: clientes }, { data: visitas }] = await Promise.all([
        supabase
          .from("clientes")
          .select("id, nombre_comercial, ciudad, telefono, proxima_accion, rubro_rel:rubro_id(dias_visita)")
          .eq("activo", true)
          .eq("ejecutivo_id", user.id)
          .not("instancia", "eq", "CENSO"),
        supabase
          .from("gestiones")
          .select("cliente_id, created_at, lat_inicio, lng_inicio, clientes!inner(ejecutivo_id)")
          .eq("tipo", "visita")
          .eq("clientes.ejecutivo_id", user.id)
          .gte("created_at", hace90.toISOString()),
      ]);

      // Última visita y coordenadas por cliente
      const ultimaVisita = new Map<string, number>();
      const coords = new Map<string, { lat: number; lng: number }[]>();
      for (const v of (visitas ?? []) as unknown as {
        cliente_id: number; created_at: string; lat_inicio: number | null; lng_inicio: number | null;
      }[]) {
        const cid = String(v.cliente_id);
        const t = new Date(v.created_at).getTime();
        if (t > (ultimaVisita.get(cid) ?? 0)) ultimaVisita.set(cid, t);
        if (v.lat_inicio != null && v.lng_inicio != null) {
          const arr = coords.get(cid) ?? [];
          arr.push({ lat: v.lat_inicio, lng: v.lng_inicio });
          coords.set(cid, arr);
        }
      }

      const ahora = Date.now();
      const resultado: Parada[] = [];
      for (const c of (clientes ?? []) as unknown as {
        id: number; nombre_comercial: string; ciudad: string | null; telefono: string | null;
        proxima_accion: string | null; rubro_rel: { dias_visita: number | null } | null;
      }[]) {
        const cid = String(c.id);
        const limite = c.rubro_rel?.dias_visita ?? 7;
        const ultima = ultimaVisita.get(cid);
        const diasDesde = ultima != null ? Math.floor((ahora - ultima) / 86_400_000) : null;
        const vencida = diasDesde === null || diasDesde >= limite;
        const proximaHoy = !!c.proxima_accion && c.proxima_accion <= hoyStr;
        if (!vencida && !proximaHoy) continue;

        const pts = coords.get(cid) ?? [];
        const centro = pts.length > 0
          ? {
              lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
              lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
            }
          : null;

        resultado.push({
          id: cid,
          nombre: c.nombre_comercial,
          ciudad: c.ciudad,
          telefono: c.telefono,
          diasDesde,
          limite,
          proximaHoy,
          lat: centro?.lat ?? null,
          lng: centro?.lng ?? null,
        });
      }

      setParadas(resultado);
      setLoading(false);
    };
    cargar();
  }, [user]);

  // Orden: con posición → por cercanía (sin ubicación al final); sin GPS → por urgencia
  const ordenadas = useMemo(() => {
    const conDist = paradas.map((p) => ({
      ...p,
      dist: pos && p.lat != null && p.lng != null
        ? distanciaMetros(pos, { lat: p.lat, lng: p.lng })
        : null,
    }));
    return conDist.sort((a, b) => {
      if (a.dist != null && b.dist != null) return a.dist - b.dist;
      if (a.dist != null) return -1;
      if (b.dist != null) return 1;
      return (b.diasDesde ?? 9999) - (a.diasDesde ?? 9999);
    });
  }, [paradas, pos]);

  return (
    <div className="min-h-screen">
      <AppHeader title="Ruta del día" subtitle="Visitas pendientes por cercanía" />

      <div className="space-y-4 px-4 pt-4 pb-8">
        {/* Estado GPS */}
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
          <div className="flex items-center gap-2 text-sm">
            <Navigation className={cn(
              "h-4 w-4",
              gpsEstado === "ok" ? "text-emerald-600" : gpsEstado === "error" ? "text-destructive" : "text-muted-foreground animate-pulse"
            )} />
            {gpsEstado === "buscando" && <span className="text-muted-foreground">Buscando tu ubicación...</span>}
            {gpsEstado === "ok" && <span>Ordenado por cercanía a tu posición</span>}
            {gpsEstado === "error" && <span className="text-muted-foreground">Sin GPS — ordenado por urgencia</span>}
          </div>
          <button
            onClick={obtenerGPS}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-smooth"
            title="Actualizar ubicación"
          >
            <RefreshCw className={cn("h-4 w-4", gpsEstado === "buscando" && "animate-spin")} />
          </button>
        </div>

        {/* Lista de paradas */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : ordenadas.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-12 text-center shadow-card">
            <p className="text-sm font-semibold">🎉 Sin visitas pendientes</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No tenés clientes con visita vencida ni agendada para hoy.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {ordenadas.map((p, i) => (
              <li key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link to={`/app/clientes/${p.id}`} className="block">
                      <p className="truncate text-sm font-bold">{p.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.ciudad ?? "Sin ciudad"}
                        {p.dist != null && <> · a {formatDist(p.dist)}</>}
                      </p>
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {p.diasDesde === null ? (
                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                          Nunca visitado
                        </span>
                      ) : p.diasDesde >= p.limite ? (
                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                          {p.diasDesde} días sin visita (límite {p.limite})
                        </span>
                      ) : null}
                      {p.proximaHoy && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                          <CalendarClock className="h-3 w-3" /> Agendada para hoy
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {p.lat != null && p.lng != null ? (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground transition-smooth hover:opacity-90"
                      >
                        <MapPin className="h-3.5 w-3.5" /> Ir
                      </a>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Sin ubicación</span>
                    )}
                    <Link to={`/app/clientes/${p.id}`} className="text-muted-foreground">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && ordenadas.length > 0 && (
          <p className="px-1 text-center text-[11px] text-muted-foreground">
            La ubicación de cada cliente se estima con el GPS de sus visitas anteriores.
            Los clientes sin visitas con GPS aparecen al final.
          </p>
        )}
      </div>
    </div>
  );
};

export default RutaDia;
