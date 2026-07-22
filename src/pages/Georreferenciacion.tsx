import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, MapPin, Search, ChevronRight, Building2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";

interface ClienteSinUbic {
  id: number;
  nombre_comercial: string;
  ciudad: string | null;
  instancia: string;
  tipo_cliente: string | null;
}

const LIMITE = 500;

const Georreferenciacion = () => {
  const { canManage, loading: profileLoading } = useProfile();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [conUbic, setConUbic] = useState(0);
  const [sinLista, setSinLista] = useState<ClienteSinUbic[]>([]);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (!profileLoading && !canManage) navigate("/app");
  }, [canManage, profileLoading, navigate]);

  useEffect(() => {
    if (!canManage) return;
    const cargar = async () => {
      setLoading(true);
      const [tot, con, sin] = await Promise.all([
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("activo", true),
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("activo", true).not("lat", "is", null),
        supabase
          .from("clientes")
          .select("id, nombre_comercial, ciudad, instancia, tipo_cliente")
          .eq("activo", true)
          .is("lat", null)
          .order("nombre_comercial")
          .limit(LIMITE),
      ]);
      setTotal(tot.count ?? 0);
      setConUbic(con.count ?? 0);
      setSinLista((sin.data ?? []) as ClienteSinUbic[]);
      setLoading(false);
    };
    cargar();
  }, [canManage]);

  const sinUbic = total - conUbic;
  const pct = total > 0 ? Math.round((conUbic / total) * 100) : 0;

  const listaFiltrada = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return sinLista;
    return sinLista.filter(
      (c) =>
        c.nombre_comercial.toLowerCase().includes(q) ||
        (c.ciudad ?? "").toLowerCase().includes(q) ||
        String(c.id).includes(q)
    );
  }, [sinLista, busqueda]);

  if (profileLoading || loading) {
    return (
      <>
        <AppHeader title="Georreferenciación" subtitle="Cargando..." />
        <div className="flex justify-center pt-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </>
    );
  }

  return (
    <>
      <AppHeader title="Georreferenciación" subtitle="Cobertura de ubicaciones" />

      <div className="px-4 pt-5 pb-8 space-y-5">
        {/* Resumen */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">{pct}% con ubicación</span>
            <span className="text-xs text-muted-foreground">{conUbic} / {total} clientes activos</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <Stat label="Total" value={total} />
            <Stat label="Con ubicación" value={conUbic} tone="ok" />
            <Stat label="Sin ubicación" value={sinUbic} tone={sinUbic > 0 ? "warn" : "ok"} />
          </div>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente sin ubicación..."
            className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm"
          />
        </div>

        {/* Lista de pendientes */}
        {sinUbic === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm font-semibold text-muted-foreground">Todos los clientes tienen ubicación ✅</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {listaFiltrada.length} sin ubicación
              {sinLista.length >= LIMITE && " (mostrando los primeros " + LIMITE + ")"}
              {" — tocá para cargar las coordenadas."}
            </p>
            {listaFiltrada.map((c) => (
              <Link
                key={c.id}
                to={`/app/clientes/${c.id}/editar`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-card hover:border-primary/40 transition-smooth"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.nombre_comercial}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.ciudad || "Sin ciudad"} · {c.instancia}
                    {c.tipo_cliente === "evento" && " · venue"}
                  </p>
                </div>
                <MapPin className="h-4 w-4 shrink-0 text-warning" />
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) => (
  <div className="rounded-xl border border-border bg-background p-2.5 text-center">
    <p className={cn(
      "text-lg font-bold tabular-nums",
      tone === "ok" ? "text-primary" : tone === "warn" ? "text-warning" : "text-foreground"
    )}>
      {value}
    </p>
    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
  </div>
);

export default Georreferenciacion;
