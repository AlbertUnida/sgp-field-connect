import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Activity, MapPin, Phone, Mail, MessageCircle, Footprints,
  Loader2, Users, Radio, ChevronRight, Navigation,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { distanciaMetros } from "@/lib/utils-field";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

interface Ejecutivo {
  id: string;
  nombre: string | null;
  apellido: string | null;
}

interface GestionLive {
  id: number;
  tipo: "visita" | "llamada" | "whatsapp" | "email";
  resultado: string | null;
  nota: string | null;
  created_at: string;
  lat_inicio: number | null;
  lng_inicio: number | null;
  cliente_id: number;
  ejecutivo_id: string;
  cliente: { nombre_comercial: string; ciudad: string | null } | null;
  ejecutivo: { nombre: string | null; apellido: string | null } | null;
}

interface UbicacionLive {
  ejecutivo_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────

const ASUNCION: [number, number] = [-25.2637, -57.5759];

// Un ejecutivo se considera "en línea" si reportó ubicación hace < 15 min
const VIGENCIA_UBICACION_MS = 15 * 60 * 1000;

// Anti-fraude: visita a más de esta distancia del centroide histórico del cliente
const UMBRAL_SOSPECHOSA_M = 500;
// Mínimo de visitas previas con GPS para tener referencia confiable
const MIN_VISITAS_REFERENCIA = 2;

// Paleta de colores por ejecutivo (se asigna por orden estable de id)
const COLORES = [
  "#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed",
  "#db2777", "#0891b2", "#65a30d", "#ea580c", "#4f46e5",
];

const ICONO_TIPO: Record<string, typeof Footprints> = {
  visita: Footprints,
  llamada: Phone,
  whatsapp: MessageCircle,
  email: Mail,
};

const GESTION_SELECT =
  "id, tipo, resultado, nota, created_at, lat_inicio, lng_inicio, cliente_id, ejecutivo_id, cliente:cliente_id(nombre_comercial, ciudad), ejecutivo:ejecutivo_id(nombre, apellido)";

const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const nombreEjecutivo = (e: { nombre: string | null; apellido: string | null } | null) =>
  e ? [e.nombre, e.apellido].filter(Boolean).join(" ") || "Sin nombre" : "Sin asignar";

// ─────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────

const Monitoreo = () => {
  const { canManage, loading: perfilLoading } = useProfile();

  const [fecha, setFecha] = useState(hoyLocal());
  const [ejecutivos, setEjecutivos] = useState<Ejecutivo[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set()); // vacío = todos
  const [gestiones, setGestiones] = useState<GestionLive[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Record<string, UbicacionLive>>({});
  const [sospechosas, setSospechosas] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [enVivo, setEnVivo] = useState(false);
  const [tick, setTick] = useState(0); // re-evalúa vigencia de ubicaciones cada minuto
  const [verRecorrido, setVerRecorrido] = useState(false);

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const trackingRef = useRef<L.LayerGroup | null>(null);
  const recorridoRef = useRef<L.LayerGroup | null>(null);

  const esHoy = fecha === hoyLocal();

  // Color estable por ejecutivo
  const colorDe = useMemo(() => {
    const mapa = new Map<string, string>();
    ejecutivos.forEach((e, i) => mapa.set(e.id, COLORES[i % COLORES.length]));
    return (id: string) => mapa.get(id) ?? "#64748b";
  }, [ejecutivos]);

  const nombreDe = useMemo(() => {
    const mapa = new Map<string, string>();
    ejecutivos.forEach((e) => mapa.set(e.id, nombreEjecutivo(e)));
    return (id: string) => mapa.get(id) ?? "Ejecutivo";
  }, [ejecutivos]);

  // ── Carga inicial de equipo ──
  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, nombre, apellido")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setEjecutivos(data ?? []));
  }, []);

  // ── Carga de gestiones del día seleccionado ──
  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      const inicio = new Date(`${fecha}T00:00:00`);
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 1);

      const { data, error } = await supabase
        .from("gestiones")
        .select(GESTION_SELECT)
        .gte("created_at", inicio.toISOString())
        .lt("created_at", fin.toISOString())
        .order("created_at", { ascending: false });

      if (error) toast.error("Error cargando actividad: " + error.message);
      setGestiones((data as unknown as GestionLive[]) ?? []);
      setLoading(false);
    };
    cargar();
  }, [fecha]);

  // ── Anti-fraude GPS: visitas lejos de la ubicación habitual del cliente ──
  useEffect(() => {
    const visitasHoy = gestiones.filter(
      (g) => g.tipo === "visita" && g.lat_inicio != null && g.lng_inicio != null
    );
    if (visitasHoy.length === 0) { setSospechosas(new Set()); return; }

    const clienteIds = [...new Set(visitasHoy.map((g) => g.cliente_id))];
    Promise.all([
      supabase
        .from("gestiones")
        .select("id, cliente_id, lat_inicio, lng_inicio")
        .eq("tipo", "visita")
        .not("lat_inicio", "is", null)
        .in("cliente_id", clienteIds),
      supabase
        .from("clientes")
        .select("id, lat, lng")
        .in("id", clienteIds),
    ]).then(([{ data: historico }, { data: clientesData }]) => {
      if (!historico) return;

      // Coordenadas cargadas en el cliente (migración/carga manual): tienen prioridad
      const fija = new Map<number, { lat: number; lng: number }>();
      for (const c of (clientesData ?? []) as { id: number; lat: number | null; lng: number | null }[]) {
        if (c.lat != null && c.lng != null) fija.set(c.id, { lat: Number(c.lat), lng: Number(c.lng) });
      }

      const historicas = new Map<number, { id: number; lat: number; lng: number }[]>();
      for (const h of historico as { id: number; cliente_id: number; lat_inicio: number; lng_inicio: number }[]) {
        const arr = historicas.get(h.cliente_id) ?? [];
        arr.push({ id: h.id, lat: h.lat_inicio, lng: h.lng_inicio });
        historicas.set(h.cliente_id, arr);
      }

      const marcadas = new Set<number>();
      for (const g of visitasHoy) {
        let ref = fija.get(g.cliente_id) ?? null;
        if (!ref) {
          // Sin coordenadas cargadas: centroide de las demás visitas con GPS
          const otras = (historicas.get(g.cliente_id) ?? []).filter((h) => h.id !== g.id);
          if (otras.length < MIN_VISITAS_REFERENCIA) continue;
          ref = {
            lat: otras.reduce((s, p) => s + p.lat, 0) / otras.length,
            lng: otras.reduce((s, p) => s + p.lng, 0) / otras.length,
          };
        }
        if (distanciaMetros(ref, { lat: g.lat_inicio!, lng: g.lng_inicio! }) > UMBRAL_SOSPECHOSA_M) {
          marcadas.add(g.id);
        }
      }
      setSospechosas(marcadas);
    });
  }, [gestiones]);

  // ── Realtime: nuevas gestiones (solo viendo HOY) ──
  useEffect(() => {
    if (!esHoy) { setEnVivo(false); return; }

    const channel = supabase
      .channel("monitoreo-gestiones")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gestiones" },
        async (payload) => {
          // El payload no trae los joins → enriquecer con un fetch puntual
          const { data } = await supabase
            .from("gestiones")
            .select(GESTION_SELECT)
            .eq("id", (payload.new as { id: number }).id)
            .single();
          if (!data) return;
          const g = data as unknown as GestionLive;
          setGestiones((prev) =>
            prev.some((x) => x.id === g.id) ? prev : [g, ...prev]
          );
          toast.info(
            `${nombreEjecutivo(g.ejecutivo)} registró ${g.tipo} en ${g.cliente?.nombre_comercial ?? "cliente"}`,
            { duration: 5000 }
          );
        }
      )
      .subscribe((status) => setEnVivo(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
      setEnVivo(false);
    };
  }, [esHoy]);

  // ── Realtime: posiciones del equipo (tracking en vivo) ──
  useEffect(() => {
    if (!esHoy) { setUbicaciones({}); return; }

    supabase
      .from("ubicaciones_ejecutivos")
      .select("*")
      .then(({ data }) => {
        const m: Record<string, UbicacionLive> = {};
        ((data as UbicacionLive[]) ?? []).forEach((u) => { m[u.ejecutivo_id] = u; });
        setUbicaciones(m);
      });

    const channel = supabase
      .channel("monitoreo-ubicaciones")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ubicaciones_ejecutivos" },
        (payload) => {
          const u = payload.new as UbicacionLive;
          if (u?.ejecutivo_id) {
            setUbicaciones((prev) => ({ ...prev, [u.ejecutivo_id]: u }));
          }
        }
      )
      .subscribe();

    const timer = setInterval(() => setTick((v) => v + 1), 60_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [esHoy]);

  // ── Filtro por ejecutivo ──
  const filtradas = useMemo(
    () =>
      seleccionados.size === 0
        ? gestiones
        : gestiones.filter((g) => seleccionados.has(g.ejecutivo_id)),
    [gestiones, seleccionados]
  );

  const visitasConGps = useMemo(
    () => filtradas.filter((g) => g.lat_inicio != null && g.lng_inicio != null),
    [filtradas]
  );

  // Ubicaciones vigentes (< 15 min) que pasan el filtro de ejecutivos
  const ubicacionesVigentes = useMemo(() => {
    void tick; // fuerza re-evaluación cada minuto
    const ahora = Date.now();
    return Object.values(ubicaciones).filter(
      (u) =>
        ahora - new Date(u.updated_at).getTime() < VIGENCIA_UBICACION_MS &&
        (seleccionados.size === 0 || seleccionados.has(u.ejecutivo_id))
    );
  }, [ubicaciones, seleccionados, tick]);

  // ── Mapa Leaflet ──
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current).setView(ASUNCION, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    trackingRef.current = L.layerGroup().addTo(map);
    recorridoRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // El contenedor se monta dentro de un grid → recalcular tamaño
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      trackingRef.current = null;
      recorridoRef.current = null;
    };
  }, []);

  // Pins de visitas
  useEffect(() => {
    const map = mapRef.current;
    const capa = markersRef.current;
    if (!map || !capa) return;
    capa.clearLayers();

    const bounds: [number, number][] = [];
    for (const g of visitasConGps) {
      const color = colorDe(g.ejecutivo_id);
      const sospechosa = sospechosas.has(g.id);
      const hora = new Date(g.created_at).toLocaleTimeString("es-PY", {
        hour: "2-digit", minute: "2-digit",
      });
      const icono = L.divIcon({
        className: "",
        html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid ${sospechosa ? "#ef4444" : "white"};box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;border-radius:50%;background:white;transform:rotate(45deg);"></div></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });
      L.marker([g.lat_inicio!, g.lng_inicio!], { icon: icono })
        .bindPopup(
          `<strong>${g.cliente?.nombre_comercial ?? "Cliente"}</strong><br/>` +
          `${nombreEjecutivo(g.ejecutivo)} · ${hora}<br/>` +
          `<span style="text-transform:capitalize">${g.tipo}</span>${g.resultado ? " — " + g.resultado : ""}` +
          (sospechosa ? '<br/><span style="color:#dc2626;font-weight:600">⚠ Lejos de la ubicación habitual del cliente</span>' : "")
        )
        .addTo(capa);
      bounds.push([g.lat_inicio!, g.lng_inicio!]);
    }
    for (const u of ubicacionesVigentes) bounds.push([u.lat, u.lng]);
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [visitasConGps, ubicacionesVigentes, colorDe, sospechosas]);

  // Posiciones en vivo (marcador pulsante por ejecutivo)
  useEffect(() => {
    const capa = trackingRef.current;
    if (!capa) return;
    capa.clearLayers();

    for (const u of ubicacionesVigentes) {
      const color = colorDe(u.ejecutivo_id);
      const min = Math.max(0, Math.round((Date.now() - new Date(u.updated_at).getTime()) / 60000));
      const icono = L.divIcon({
        className: "",
        html:
          `<div style="position:relative;width:20px;height:20px;">` +
          `<span class="animate-ping" style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:.45;"></span>` +
          `<span style="position:absolute;inset:3px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);"></span>` +
          `</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      L.marker([u.lat, u.lng], { icon: icono, zIndexOffset: 1000 })
        .bindPopup(
          `<strong>${nombreDe(u.ejecutivo_id)}</strong><br/>` +
          `En línea · última señal hace ${min === 0 ? "menos de 1" : min} min`
        )
        .addTo(capa);
    }
  }, [ubicacionesVigentes, colorDe, nombreDe]);

  // Recorrido histórico: polilínea por ejecutivo del día seleccionado
  useEffect(() => {
    const capa = recorridoRef.current;
    if (!capa) return;
    capa.clearLayers();
    if (!verRecorrido) return;
    const cargar = async () => {
      const inicio = new Date(`${fecha}T00:00:00`);
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 1);
      const { data } = await supabase
        .from("ubicaciones_historial")
        .select("ejecutivo_id, lat, lng")
        .gte("created_at", inicio.toISOString())
        .lt("created_at", fin.toISOString())
        .order("created_at", { ascending: true });
      const porEje = new Map<string, [number, number][]>();
      for (const p of (data ?? []) as { ejecutivo_id: string; lat: number; lng: number }[]) {
        if (seleccionados.size > 0 && !seleccionados.has(p.ejecutivo_id)) continue;
        const arr = porEje.get(p.ejecutivo_id) ?? [];
        arr.push([Number(p.lat), Number(p.lng)]);
        porEje.set(p.ejecutivo_id, arr);
      }
      porEje.forEach((puntos, id) => {
        if (puntos.length < 2) return;
        L.polyline(puntos, { color: colorDe(id), weight: 3, opacity: 0.7, dashArray: "6 4" }).addTo(capa);
      });
    };
    cargar();
  }, [verRecorrido, fecha, seleccionados, colorDe]);

  // ── Guard de acceso (después de todos los hooks) ──
  if (!perfilLoading && !canManage) return <Navigate to="/app" replace />;

  const toggleEjecutivo = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // IDs de ejecutivos con actividad en el día (para ordenar chips)
  const activosHoy = new Set(gestiones.map((g) => g.ejecutivo_id));
  const enLinea = new Set(ubicacionesVigentes.map((u) => u.ejecutivo_id));
  const sospechosasVisibles = filtradas.filter((g) => sospechosas.has(g.id)).length;

  return (
    <div className="min-h-screen">
      <AppHeader
        wide
        title="Monitoreo en vivo"
        subtitle={esHoy ? "Actividad del equipo en tiempo real" : `Actividad del ${fecha}`}
      />

      <div className="mx-auto max-w-7xl px-4 pt-4 space-y-4">
        {/* Barra: fecha + estado en vivo + KPIs */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={fecha}
            max={hoyLocal()}
            onChange={(e) => setFecha(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
          />
          {esHoy && (
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                enVivo ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
              )}
            >
              <Radio className={cn("h-3.5 w-3.5", enVivo && "animate-pulse")} />
              {enVivo ? "EN VIVO" : "Conectando..."}
            </span>
          )}
          <button
            onClick={() => setVerRecorrido((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-smooth",
              verRecorrido ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            <Navigation className="h-3.5 w-3.5" /> Recorrido
          </button>
          <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Activity className="h-4 w-4" /> {filtradas.length} gestiones
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {visitasConGps.length} con GPS
            </span>
            {sospechosasVisibles > 0 && (
              <span className="flex items-center gap-1 font-semibold text-red-600">
                ⚠ {sospechosasVisibles} sospechosa{sospechosasVisibles > 1 ? "s" : ""}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" /> {activosHoy.size} activos
            </span>
            {esHoy && (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <Navigation className="h-4 w-4" /> {enLinea.size} en línea
              </span>
            )}
          </div>
        </div>

        {/* Filtro por ejecutivo */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSeleccionados(new Set())}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-smooth",
              seleccionados.size === 0
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40"
            )}
          >
            Todos
          </button>
          {[...ejecutivos]
            .sort((a, b) => Number(activosHoy.has(b.id)) - Number(activosHoy.has(a.id)))
            .map((e) => (
              <button
                key={e.id}
                onClick={() => toggleEjecutivo(e.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-smooth",
                  seleccionados.has(e.id)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40",
                  !activosHoy.has(e.id) && !enLinea.has(e.id) && "opacity-60"
                )}
              >
                <span
                  className={cn("h-2.5 w-2.5 rounded-full shrink-0", enLinea.has(e.id) && "ring-2 ring-emerald-400/60")}
                  style={{ backgroundColor: colorDe(e.id) }}
                />
                {nombreEjecutivo(e)}
              </button>
            ))}
        </div>

        {/* Mapa + Feed: apilado en móvil, lado a lado en lg+ */}
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          {/* Mapa */}
          <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
            <div ref={mapDivRef} className="h-[45vh] w-full lg:h-[calc(100vh-320px)]" />
          </div>

          {/* Feed de actividad */}
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-bold">Actividad {esHoy ? "de hoy" : "del día"}</h2>
            </div>
            <div className="max-h-[50vh] overflow-y-auto lg:max-h-[calc(100vh-380px)]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtradas.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Sin gestiones registradas {esHoy ? "todavía" : "en esta fecha"}.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {filtradas.map((g) => {
                    const Icono = ICONO_TIPO[g.tipo] ?? Activity;
                    const hora = new Date(g.created_at).toLocaleTimeString("es-PY", {
                      hour: "2-digit", minute: "2-digit",
                    });
                    return (
                      <li key={g.id}>
                        <Link
                          to={`/app/clientes/${g.cliente_id}`}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-smooth"
                        >
                          <span
                            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: colorDe(g.ejecutivo_id) }}
                          >
                            <Icono className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {g.cliente?.nombre_comercial ?? "Cliente"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {nombreEjecutivo(g.ejecutivo)} ·{" "}
                              <span className="capitalize">{g.tipo}</span>
                              {g.resultado ? ` · ${g.resultado}` : ""}
                            </p>
                            {sospechosas.has(g.id) && (
                              <p className="mt-0.5 text-[10px] font-semibold text-red-600">
                                ⚠ Visita a más de 500 m de la ubicación habitual del cliente
                              </p>
                            )}
                            {g.nota && (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
                                {g.nota}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-xs font-medium text-muted-foreground">{hora}</span>
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              {g.lat_inicio != null && <MapPin className={cn("h-3 w-3", sospechosas.has(g.id) ? "text-red-500" : "text-emerald-600")} />}
                              <ChevronRight className="h-3 w-3" />
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Monitoreo;
