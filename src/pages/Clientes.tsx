import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, MapPin, Phone, ChevronRight, Loader2, User } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { formatPYG, relativeDate } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { getLeadScoreInfo, scoreClasses } from "@/lib/lead-score";

interface ClienteReal {
  id: string;
  numero_cliente: number | null;
  nombre_comercial: string;
  rubro: string | null;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  instancia: string | null;
  tarifa_mensual: number | null;
  proxima_accion: string | null;
  ultima_gestion: string | null;
  ejecutivo_nombre: string | null;
  ejecutivo_id: string | null;
  creado_por: string | null;
  creado_por_nombre: string | null;
  tipo_cliente: string | null;
  lead_score: number | null;
}

const Clientes = () => {
  const { user } = useAuth();
  const { isAdmin, canManage } = useProfile();
  const [searchParams] = useSearchParams();
  const ejFilter = searchParams.get("ej"); // ejecutivo_id param for supervisor drill-down
  const [clientes, setClientes] = useState<ClienteReal[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [tipFilter, setTipFilter] = useState<string>("all"); // "all" | "local" | "evento"
  const [censoEjFilter, setCensoEjFilter] = useState<string>("");

  // Lista de ejecutivos que tienen clientes en CENSO (para sub-filtro)
  const censoEjecutivos = useMemo(() => {
    const map = new Map<string, string>();
    clientes
      .filter((c) => c.instancia === "CENSO" && c.creado_por && c.creado_por_nombre)
      .forEach((c) => {
        if (!map.has(c.creado_por!)) map.set(c.creado_por!, c.creado_por_nombre!);
      });
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [clientes]);

  useEffect(() => {
    if (!user) return;
    cargarClientes();
  }, [user, isAdmin, ejFilter]);

  const cargarClientes = async () => {
    setLoading(true);

    let query = supabase
      .from("clientes")
      .select("id, numero_cliente, nombre_comercial, rubro, direccion, ciudad, telefono, instancia, tarifa_mensual, proxima_accion, ultima_gestion, creado_por, ejecutivo_id, tipo_cliente, ejecutivo:ejecutivo_id(nombre, apellido), creador:creado_por(nombre, apellido)")
      .eq("activo", true)
      .order("nombre_comercial");

    // Admin y supervisor ven todos; ejecutivo ve TODOS los clientes (solo lectura en los ajenos)
    if (canManage && ejFilter) {
      // Filtro por ejecutivo específico (drill-down desde Seguimiento)
      query = query.eq("ejecutivo_id", ejFilter);
    }

    // Carga clientes y scores en paralelo
    const [{ data, error }, { data: scoreRows }] = await Promise.all([
      query,
      supabase.from("cliente_lead_scores").select("cliente_id, lead_score"),
    ]);
    if (error) console.error("Error cargando clientes:", error);

    // Mapa cliente_id → lead_score
    const scoreMap = new Map<string, number>();
    (scoreRows ?? []).forEach((r: any) => {
      scoreMap.set(String(r.cliente_id), Number(r.lead_score) || 0);
    });

    const mapped = (data ?? []).map((c: any) => ({
      ...c,
      numero_cliente: c.numero_cliente ?? null,
      ejecutivo_id: c.ejecutivo_id ?? null,
      creado_por: c.creado_por ?? null,
      tipo_cliente: c.tipo_cliente ?? null,
      ejecutivo_nombre: c.ejecutivo
        ? `${c.ejecutivo.nombre ?? ""} ${c.ejecutivo.apellido ?? ""}`.trim()
        : null,
      creado_por_nombre: c.creador
        ? `${c.creador.nombre ?? ""} ${c.creador.apellido ?? ""}`.trim()
        : null,
      lead_score: scoreMap.has(String(c.id)) ? scoreMap.get(String(c.id))! : null,
    }));

    setClientes(mapped);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      const qLower = q.toLowerCase();
      const idStr = c.numero_cliente ? String(c.numero_cliente).padStart(4, "0") : "";
      const soloNumeros = q.replace(/\D/g, "");
      const matchQ =
        !q ||
        c.nombre_comercial.toLowerCase().includes(qLower) ||
        (c.rubro ?? "").toLowerCase().includes(qLower) ||
        (c.ciudad ?? "").toLowerCase().includes(qLower) ||
        (soloNumeros.length > 0 && idStr.includes(soloNumeros)) // busca por número solo si hay dígitos

      let matchF: boolean;
      if (canManage) {
        // Admin / supervisor: filtro normal sin restricciones
        matchF = filter === "all" || (c.instancia ?? "CENSO") === filter;
        // Sub-filtro por ejecutivo creador en CENSO
        if (matchF && filter === "CENSO" && censoEjFilter) {
          matchF = c.creado_por === censoEjFilter;
        }
      } else if (filter === "all") {
        // TODOS: consulta global para evitar duplicados
        matchF = true;
      } else if (filter === "CENSO") {
        // CENSO: ejecutivo ve los que él creó (ejecutivo_id es null hasta que se asigne)
        matchF = c.instancia === "CENSO" && c.creado_por === user?.id;
      } else {
        // Otras instancias: ejecutivo solo ve los suyos (por ejecutivo_id asignado)
        matchF = (c.instancia ?? "CENSO") === filter && c.ejecutivo_id === user?.id;
      }

      // Filtro por tipo de cliente (Local / Evento)
      const matchTip = tipFilter === "all" || (c.tipo_cliente ?? "local") === tipFilter;

      return matchQ && matchF && matchTip;
    });
  }, [clientes, q, filter, tipFilter, censoEjFilter, user, canManage]);

  return (
    <>
      <AppHeader
        title={ejFilter && canManage ? "Cartera del ejecutivo" : canManage ? "Cartera total" : "Clientes"}
        subtitle={loading ? "Cargando..." : `${filtered.length} clientes`}
      />

      <div className="px-4 pt-4">
        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, ID, rubro o ciudad..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-12 rounded-2xl border-border bg-card pl-10 shadow-card"
          />
        </div>

        {/* Filtros por instancia */}
        <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-1">
          <div className="flex gap-2">
            {[
              { key: "all", label: "Todos", color: undefined },
              { key: "CENSO", label: "Censo", color: "#6b7280" },
              { key: "COMERCIAL", label: "Comercial", color: "#3b82f6" },
              { key: "COBRANZAS", label: "Cobranzas", color: "#22c55e" },
              { key: "JURIDICO", label: "Jurídico", color: "#ef4444" },
            ].map((f) => (
              <FilterChip
                key={f.key}
                active={filter === f.key}
                onClick={() => { setFilter(f.key); setCensoEjFilter(""); }}
                color={f.color}
              >
                {f.label}
              </FilterChip>
            ))}
          </div>
        </div>

        {/* Filtro por tipo de cliente */}
        <div className="-mx-4 mt-2 overflow-x-auto px-4 pb-1">
          <div className="flex gap-2 items-center">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">Tipo:</span>
            <FilterChip active={tipFilter === "all"} onClick={() => setTipFilter("all")}>Todos</FilterChip>
            <FilterChip active={tipFilter === "local"} onClick={() => setTipFilter("local")} color="#3b82f6">🏪 Local</FilterChip>
            <FilterChip active={tipFilter === "evento"} onClick={() => setTipFilter("evento")} color="#f59e0b">🎉 Evento</FilterChip>
          </div>
        </div>

        {/* Sub-filtro por ejecutivo — solo en CENSO y para canManage */}
        {canManage && filter === "CENSO" && censoEjecutivos.length > 0 && (
          <div className="-mx-4 mt-2 overflow-x-auto px-4 pb-1">
            <div className="flex gap-1.5 items-center">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">Ejecutivo:</span>
              <FilterChip active={censoEjFilter === ""} onClick={() => setCensoEjFilter("")}>
                Todos
              </FilterChip>
              {censoEjecutivos.map((ej) => (
                <FilterChip
                  key={ej.id}
                  active={censoEjFilter === ej.id}
                  onClick={() => setCensoEjFilter(ej.id)}
                >
                  {ej.nombre}
                </FilterChip>
              ))}
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="mt-4 space-y-2.5 pb-4">
          {loading ? (
            <div className="flex justify-center pt-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <p className="text-sm font-semibold">Sin resultados</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Probá con otra búsqueda o filtro
              </p>
            </div>
          ) : (
            filtered.map((c) => (
              <Link
                key={c.id}
                to={`/app/clientes/${c.id}`}
                className={cn(
                  "block rounded-2xl border bg-card p-4 shadow-card transition-smooth hover:shadow-elevated active:scale-[0.99]",
                  !canManage && c.instancia === "CENSO"
                    ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
                    : "border-border hover:border-primary/40"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {c.numero_cliente && (
                      <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-0.5">
                        ID {String(c.numero_cliente).padStart(4, "0")}
                      </p>
                    )}
                    <h3 className="truncate text-sm font-bold">{c.nombre_comercial}</h3>
                    {c.rubro && <p className="mt-0.5 text-xs text-muted-foreground">{c.rubro}</p>}
                    {c.tipo_cliente && (
                      <span className={cn(
                        "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold",
                        c.tipo_cliente === "evento"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                      )}>
                        {c.tipo_cliente === "evento" ? "🎉 Evento" : "🏪 Local"}
                      </span>
                    )}
                    {/* Creador visible en CENSO para canManage */}
                    {canManage && c.instancia === "CENSO" && c.creado_por_nombre && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                        <User className="h-3 w-3" />
                        Creado por {c.creado_por_nombre}
                      </p>
                    )}
                    {/* Ejecutivo asignado: visible para canManage y para ejecutivos cuando no es su cliente */}
                    {c.ejecutivo_nombre && c.instancia !== "CENSO" && (canManage || c.ejecutivo_id !== user?.id) && (
                      <p className={cn(
                        "mt-0.5 flex items-center gap-1 text-[11px] font-semibold",
                        c.ejecutivo_id === user?.id ? "text-primary" : "text-muted-foreground"
                      )}>
                        <User className="h-3 w-3" />
                        {c.ejecutivo_id === user?.id ? "Mi cliente" : c.ejecutivo_nombre}
                      </p>
                    )}
                  </div>
                  {/* Columna derecha: instancia + lead score */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <InstanciaBadge instancia={c.instancia} />
                    {c.lead_score !== null && (() => {
                      const info = getLeadScoreInfo(c.lead_score);
                      const cls = scoreClasses(info.category);
                      return (
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", cls.bg, cls.text)}>
                          {info.emoji} {info.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                {/* Aviso CENSO para ejecutivos */}
                {!canManage && c.instancia === "CENSO" && (
                  <p className="mt-2 rounded-xl bg-amber-100 px-3 py-1.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    ⏳ En CENSO — sin ejecutivo asignado aún
                  </p>
                )}

                <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-[11px] text-muted-foreground">
                  {c.ciudad && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{c.ciudad}</span>
                    </span>
                  )}
                  {c.telefono && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{c.telefono}</span>
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tarifa</p>
                    <p className="text-sm font-bold tabular-nums text-primary">
                      {c.tarifa_mensual ? formatPYG(c.tarifa_mensual) : "—"}
                    </p>
                  </div>
                  {c.ultima_gestion && (
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Último contacto</p>
                      <p className="text-xs font-semibold">{relativeDate(c.ultima_gestion)}</p>
                    </div>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
};

const INSTANCIA_COLORS: Record<string, string> = {
  CENSO: "bg-gray-100 text-gray-600",
  COMERCIAL: "bg-blue-100 text-blue-700",
  COBRANZAS: "bg-green-100 text-green-700",
  JURIDICO: "bg-red-100 text-red-700",
};

const InstanciaBadge = ({ instancia }: { instancia: string | null }) => (
  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", INSTANCIA_COLORS[instancia ?? "censo"] ?? "bg-gray-100 text-gray-600")}>
    {instancia ?? "censo"}
  </span>
);

const FilterChip = ({ children, active, onClick, color }: { children: React.ReactNode; active: boolean; onClick: () => void; color?: string }) => (
  <button
    onClick={onClick}
    className={cn(
      "shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-smooth",
      active ? "border-primary bg-primary text-primary-foreground shadow-card" : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
    )}
  >
    {color && !active && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: color }} />}
    {children}
  </button>
);

export default Clientes;
