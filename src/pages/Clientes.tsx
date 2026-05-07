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

interface ClienteReal {
  id: string;
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

  useEffect(() => {
    if (!user) return;
    cargarClientes();
  }, [user, isAdmin, ejFilter]);

  const cargarClientes = async () => {
    setLoading(true);

    let query = supabase
      .from("clientes")
      .select("id, nombre_comercial, rubro, direccion, ciudad, telefono, instancia, tarifa_mensual, proxima_accion, ultima_gestion, ejecutivo:ejecutivo_id(nombre, apellido)")
      .eq("activo", true)
      .order("nombre_comercial");

    // Admin y supervisor ven todos; ejecutivo ve TODOS los clientes (solo lectura en los ajenos)
    if (canManage && ejFilter) {
      // Filtro por ejecutivo específico (drill-down desde Seguimiento)
      query = query.eq("ejecutivo_id", ejFilter);
    }

    const { data, error } = await query;
    if (error) console.error("Error cargando clientes:", error);

    const mapped = (data ?? []).map((c: any) => ({
      ...c,
      ejecutivo_id: c.ejecutivo_id ?? null,
      ejecutivo_nombre: c.ejecutivo
        ? `${c.ejecutivo.nombre ?? ""} ${c.ejecutivo.apellido ?? ""}`.trim()
        : null,
    }));

    setClientes(mapped);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      const matchQ =
        !q ||
        c.nombre_comercial.toLowerCase().includes(q.toLowerCase()) ||
        (c.rubro ?? "").toLowerCase().includes(q.toLowerCase()) ||
        (c.ciudad ?? "").toLowerCase().includes(q.toLowerCase());

      let matchF: boolean;
      if (canManage) {
        // Admin / supervisor: filtro normal sin restricciones
        matchF = filter === "all" || (c.instancia ?? "CENSO") === filter;
      } else if (filter === "all") {
        // TODOS: consulta global para evitar duplicados
        matchF = true;
      } else {
        // Filtro por instancia: ejecutivo solo ve los suyos
        matchF = (c.instancia ?? "CENSO") === filter && c.ejecutivo_id === user?.id;
      }

      return matchQ && matchF;
    });
  }, [clientes, q, filter, user, canManage]);

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
            placeholder="Buscar cliente, rubro o ciudad..."
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
              <FilterChip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} color={f.color}>
                {f.label}
              </FilterChip>
            ))}
          </div>
        </div>

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
                    <h3 className="truncate text-sm font-bold">{c.nombre_comercial}</h3>
                    {c.rubro && <p className="mt-0.5 text-xs text-muted-foreground">{c.rubro}</p>}
                    {/* Ejecutivo asignado: visible para canManage y para ejecutivos cuando no es su cliente */}
                    {c.ejecutivo_nombre && (canManage || c.ejecutivo_id !== user?.id) && (
                      <p className={cn(
                        "mt-0.5 flex items-center gap-1 text-[11px] font-semibold",
                        c.ejecutivo_id === user?.id ? "text-primary" : "text-muted-foreground"
                      )}>
                        <User className="h-3 w-3" />
                        {c.ejecutivo_id === user?.id ? "Mi cliente" : c.ejecutivo_nombre}
                      </p>
                    )}
                  </div>
                  <InstanciaBadge instancia={c.instancia} />
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
