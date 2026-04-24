import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Calendar, CheckCircle2, Clock, MapPin, Target, TrendingUp, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { formatPYG, relativeDate } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";

const MES_ACTUAL = new Date().getMonth() + 1;
const ANIO_ACTUAL = new Date().getFullYear();
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const Inicio = () => {
  const { user } = useAuth();
  const { profile, nombreCompleto } = useProfile();

  const [meta, setMeta] = useState<{ monto_meta: number } | null>(null);
  const [cobradoMes, setCobradoMes] = useState(0);
  const [cobrosCount, setCobrosCount] = useState(0);
  const [deficitAnterior, setDeficitAnterior] = useState(0);
  const [clientes, setClientes] = useState<any[]>([]);
  const [pendientes, setPendientes] = useState(0);
  const [totalAsignados, setTotalAsignados] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    cargarDatos();
  }, [user]);

  const cargarDatos = async () => {
    setLoading(true);

    // Meta del mes actual
    const { data: metaData } = await supabase
      .from("metas")
      .select("monto_meta")
      .eq("ejecutivo_id", user!.id)
      .eq("mes", MES_ACTUAL)
      .eq("anio", ANIO_ACTUAL)
      .maybeSingle();

    setMeta(metaData);

    // Cobros del mes actual
    const { data: cobrosData } = await supabase
      .from("cobros")
      .select("monto")
      .eq("ejecutivo_id", user!.id)
      .gte("fecha_cobro", `${ANIO_ACTUAL}-${String(MES_ACTUAL).padStart(2, "0")}-01`);

    const totalCobrado = cobrosData?.reduce((sum, c) => sum + (c.monto || 0), 0) ?? 0;
    setCobradoMes(totalCobrado);
    setCobrosCount(cobrosData?.length ?? 0);

    // Déficit del mes anterior
    const { data: ejecData } = await supabase
      .from("ejecucion_meta")
      .select("deficit_nuevo")
      .eq("ejecutivo_id", user!.id)
      .eq("mes", MES_ACTUAL === 1 ? 12 : MES_ACTUAL - 1)
      .eq("anio", MES_ACTUAL === 1 ? ANIO_ACTUAL - 1 : ANIO_ACTUAL)
      .maybeSingle();

    setDeficitAnterior(ejecData?.deficit_nuevo ?? 0);

    // Clientes asignados con próxima acción
    const { data: clientesData } = await supabase
      .from("clientes")
      .select("id, nombre_comercial, ciudad, instancia, proxima_accion")
      .eq("ejecutivo_id", user!.id)
      .eq("activo", true)
      .not("proxima_accion", "is", null)
      .order("proxima_accion")
      .limit(4);

    setClientes(clientesData ?? []);

    // Clientes pendientes de contacto hoy
    const hoy = new Date().toISOString().split("T")[0];
    const { count: countPendientes } = await supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("ejecutivo_id", user!.id)
      .eq("activo", true)
      .lte("proxima_accion", hoy);

    setPendientes(countPendientes ?? 0);

    // Total de clientes asignados activos
    const { count: countAsignados } = await supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("ejecutivo_id", user!.id)
      .eq("activo", true);

    setTotalAsignados(countAsignados ?? 0);

    setLoading(false);
  };

  const montoMeta = meta?.monto_meta ?? 0;
  const metaTotal = montoMeta + deficitAnterior;
  const pct = metaTotal > 0 ? Math.round((cobradoMes / metaTotal) * 100) : 0;
  const goalColor = pct < 60 ? "text-destructive" : pct < 85 ? "text-warning" : "text-success";
  const goalBar = pct < 60 ? "bg-destructive" : pct < 85 ? "bg-warning" : "bg-success";

  const nombre = profile?.nombre ?? nombreCompleto?.split(" ")[0] ?? "!";

  return (
    <>
      <AppHeader
        title={`Hola, ${nombre} 👋`}
        subtitle={`${MESES[MES_ACTUAL - 1]} ${ANIO_ACTUAL}`}
      />

      {loading ? (
        <div className="flex justify-center pt-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5 px-4 pt-5">

          {/* Tarjeta de meta */}
          <section className="animate-fade-in rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Meta mensual</p>
                {montoMeta === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">Sin meta asignada este mes</p>
                ) : (
                  <>
                    <p className="mt-1 text-2xl font-bold tabular-nums">{formatPYG(cobradoMes)}</p>
                    <p className="text-xs text-muted-foreground">
                      de <span className="font-semibold text-foreground">{formatPYG(metaTotal)}</span>
                      {deficitAnterior > 0 && (
                        <span className="ml-1 text-destructive">(+{formatPYG(deficitAnterior)} déficit anterior)</span>
                      )}
                    </p>
                  </>
                )}
              </div>
              <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary", goalColor)}>
                <Target className="h-6 w-6" />
              </div>
            </div>

            {montoMeta > 0 && (
              <div className="mt-4 space-y-2">
                <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div className={cn("h-full rounded-full transition-all", goalBar)} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={cn("font-bold", goalColor)}>{pct}% completado</span>
                  <span className="text-muted-foreground">
                    Falta: <span className="font-semibold">{formatPYG(Math.max(0, metaTotal - cobradoMes))}</span>
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* KPIs rápidos */}
          <section className="grid grid-cols-3 gap-3">
            <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Cobros" value={String(cobrosCount)} trend={`${pct}% del obj.`} tone="success" />
            <StatCard icon={<Clock className="h-4 w-4" />} label="Pendientes" value={String(pendientes)} trend="para hoy" tone="warning" />
            <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Cartera" value={String(totalAsignados)} trend="clientes activos" tone="primary" />
          </section>

          {/* Próximas acciones */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold">Próximas acciones</h2>
              <Link to="/app/clientes" className="text-xs font-semibold text-primary">Ver cartera</Link>
            </div>

            {clientes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <p className="text-sm font-semibold text-muted-foreground">Sin acciones pendientes</p>
                <p className="mt-1 text-xs text-muted-foreground">Tus próximas visitas aparecerán acá</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {clientes.map((c) => (
                  <Link
                    key={c.id}
                    to={`/app/clientes/${c.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-card transition-smooth hover:border-primary/30 hover:shadow-elevated"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{c.nombre_comercial}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.ciudad}</span>
                        {c.proxima_accion && (
                          <>
                            <span>·</span>
                            <span>{relativeDate(c.proxima_accion)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-700">{c.instancia ?? "censo"}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
};

const StatCard = ({
  icon, label, value, trend, tone,
}: { icon: React.ReactNode; label: string; value: string; trend: string; tone: "success" | "warning" | "primary" }) => {
  const toneClass = tone === "success" ? "text-success bg-success/10" : tone === "warning" ? "text-warning bg-warning/10" : "text-primary bg-primary/10";
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
      <div className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg", toneClass)}>{icon}</div>
      <p className="mt-2 text-lg font-bold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{trend}</p>
    </div>
  );
};

export default Inicio;
