import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, Phone, ChevronRight, Loader2 } from "lucide-react";
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
}

const Clientes = () => {
  const { user } = useAuth();
  const { isAdmin } = useProfile();
  const [clientes, setClientes] = useState<ClienteReal[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    cargarClientes();
  }, [user, isAdmin]);

  const cargarClientes = async () => {
    setLoading(true);

    let query = supabase
      .from("clientes")
      .select("id, nombre_comercial, rubro, direccion, ciudad, telefono, instancia, tarifa_mensual, proxima_accion, ultima_gestion")
      .eq("activo", true)
      .order("nombre_comercial");

    // Admin ve todos, ejecutivo solo los suyos
    if (!isAdmin) {
      query = query.eq("ejecutivo_id", user!.id);
    }

    const { data, error } = await query;
    if (error) console.error("Error cargando clientes:", error);
    setClientes(data ?? []);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      const matchQ =
        !q ||
        c.nombre_comercial.toLowerCase().includes(q.toLowerCase()) ||
        (c.rubro ?? "").toLowerCase().includes(q.toLowerCase()) ||
        (c.ciudad ?? "").toLowerCase().includes(q.toLowerCase());
      const matchF = filter === "all" || (c.instancia ?? "CENSO") === filter;
      return matchQ && matchF;
    });
  }, [clientes, q, filter]);

  return (
    <>
      <AppHeader
        title="Mi Cartera"
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
              <p className="text-sm font-semibold">
                {clientes.length === 0 ? "Sin clientes asignados" : "Sin resultados"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {clientes.length === 0
                  ? "El administrador debe asignarte clientes desde el Panel Admin"
                  : "Probá con otra búsqueda o filtro"}
              </p>
            </div>
          ) : (
            filtered.map((c) => (
              <Link
                key={c.id}
                to={`/app/clientes/${c.id}`}
                className="block rounded-2xl border border-border bg-card p-4 shadow-card transition-smooth hover:border-primary/40 hover:shadow-elevated active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold">{c.nombre_comercial}</h3>
                    {c.rubro && <p className="mt-0.5 text-xs text-muted-foreground">{c.rubro}</p>}
                  </div>
                  <InstanciaBadge instancia={c.instancia} />
                </div>

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
