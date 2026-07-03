import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, CheckCircle2, Clock, MapPin, Target, TrendingUp, Loader2, AlertTriangle, PhoneCall, CalendarClock, ChevronRight, Users, BarChart2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { formatPYG, relativeDate } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";

const MES_ACTUAL = new Date().getMonth() + 1;
const ANIO_ACTUAL = new Date().getFullYear();
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// Agrega horas hábiles (lun–vie) a una fecha
function addBusinessHours(start: Date, hours: number): Date {
  const result = new Date(start);
  let remaining = hours;
  while (remaining > 0) {
    result.setTime(result.getTime() + 3_600_000);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return result;
}

const Inicio = () => {
  const { user } = useAuth();
  const { profile, nombreCompleto, canManage } = useProfile();
  const navigate = useNavigate();

  const [meta, setMeta] = useState<{ monto_meta: number } | null>(null);
  const [cobradoMes, setCobradoMes] = useState(0);
  const [cobrosCount, setCobrosCount] = useState(0);
  const [deficitAnterior, setDeficitAnterior] = useState(0);
  const [clientes, setClientes] = useState<any[]>([]);
  const [pendientes, setPendientes] = useState(0);
  const [totalAsignados, setTotalAsignados] = useState(0);
  const [visitasVencidas, setVisitasVencidas] = useState(0);
  const [contactosVencidos, setContactosVencidos] = useState(0);
  const [proximosVencimientos, setProximosVencimientos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // KPIs del equipo (solo canManage)
  const [equipoKpis, setEquipoKpis] = useState({
    totalCobrado: 0,
    totalMeta: 0,
    totalClientes: 0,
    totalEjecutivos: 0,
    visitasVencidasEquipo: 0,
    contactosVencidosEquipo: 0,
  });

  useEffect(() => {
    if (!user) return;
    cargarDatos();
  }, [user, canManage]); // canManage puede llegar después del user (perfil async)

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

    // Cobros del mes actual (con límite superior para no contar cobros de meses futuros)
    const primerDiaMes = `${ANIO_ACTUAL}-${String(MES_ACTUAL).padStart(2, "0")}-01`;
    const mesSiguiente = MES_ACTUAL === 12 ? 1 : MES_ACTUAL + 1;
    const anioSiguiente = MES_ACTUAL === 12 ? ANIO_ACTUAL + 1 : ANIO_ACTUAL;
    const primerDiaSiguiente = `${anioSiguiente}-${String(mesSiguiente).padStart(2, "0")}-01`;
    const { data: cobrosData } = await supabase
      .from("cobros")
      .select("monto")
      .eq("ejecutivo_id", user!.id)
      .gte("fecha_cobro", primerDiaMes)
      .lt("fecha_cobro", primerDiaSiguiente);
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

    // Clientes con próxima acción
    const { data: clientesData } = await supabase
      .from("clientes")
      .select("id, nombre_comercial, ciudad, instancia, proxima_accion")
      .eq("ejecutivo_id", user!.id)
      .eq("activo", true)
      .not("proxima_accion", "is", null)
      .order("proxima_accion")
      .limit(4);
    setClientes(clientesData ?? []);

    // Pendientes hoy
    const hoy = new Date().toISOString().split("T")[0];
    const { count: countPendientes } = await supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("ejecutivo_id", user!.id)
      .eq("activo", true)
      .lte("proxima_accion", hoy);
    setPendientes(countPendientes ?? 0);

    // Total cartera activa
    const { count: countAsignados } = await supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("ejecutivo_id", user!.id)
      .eq("activo", true);
    setTotalAsignados(countAsignados ?? 0);

    // ── KPIs del equipo (solo canManage) ────────────────────
    if (canManage) {
      const [{ data: cobrosEquipo }, { data: metasEquipo }, { count: totalClientesEquipo }, { data: perfiles }] = await Promise.all([
        supabase.from("cobros").select("monto").gte("fecha_cobro", primerDiaMes).lt("fecha_cobro", primerDiaSiguiente),
        supabase.from("metas").select("monto_meta").eq("mes", MES_ACTUAL).eq("anio", ANIO_ACTUAL),
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("activo", true).not("instancia", "eq", "CENSO"),
        supabase.from("profiles").select("id").eq("rol", "ejecutivo").eq("activo", true),
      ]);
      setEquipoKpis((prev) => ({
        ...prev,
        totalCobrado: cobrosEquipo?.reduce((s, c) => s + (c.monto || 0), 0) ?? 0,
        totalMeta: metasEquipo?.reduce((s, m) => s + (m.monto_meta || 0), 0) ?? 0,
        totalClientes: totalClientesEquipo ?? 0,
        totalEjecutivos: perfiles?.length ?? 0,
      }));
    }

    // ── Alertas de vencimiento ──────────────────────────────
    let alertasQuery = supabase
      .from("clientes")
      .select("id, rubro_rel:rubro_id(dias_visita)")
      .eq("activo", true)
      .not("instancia", "eq", "CENSO");

    if (!canManage) alertasQuery = alertasQuery.eq("ejecutivo_id", user!.id);

    const { data: clientesGestion } = await alertasQuery;

    if (clientesGestion && clientesGestion.length > 0) {
      const hace30Dias = new Date();
      hace30Dias.setDate(hace30Dias.getDate() - 30);

      // A4: JOIN en lugar de .in() — escala a >200 clientes sin límite de URL
      let gQuery = supabase
        .from("gestiones")
        .select("id, cliente_id, tipo, created_at, clientes!inner(ejecutivo_id, instancia, activo)")
        .eq("clientes.activo", true)
        .not("clientes.instancia", "eq", "CENSO")
        .gte("created_at", hace30Dias.toISOString())
        .order("created_at", { ascending: true });

      if (!canManage) gQuery = gQuery.eq("clientes.ejecutivo_id", user!.id);

      const { data: gestiones } = await gQuery;

      const gestionesArr = gestiones ?? [];
      const ahora = new Date();
      let vVisitas = 0;
      let vContactos = 0;

      for (const c of clientesGestion) {
        const diasVisita = (c.rubro_rel as any)?.dias_visita ?? 7;

        // Visitas vencidas
        const visitas = gestionesArr
          .filter((g) => g.cliente_id === c.id && g.tipo === "visita")
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const diasDesdeVisita = visitas.length === 0
          ? 30
          : (ahora.getTime() - new Date(visitas[0].created_at).getTime()) / 86_400_000;

        if (diasDesdeVisita > diasVisita) vVisitas++;

        // Contactos vencidos: visita sin seguimiento en 24h hábiles
        const visitasRecientes = gestionesArr.filter(
          (g) => g.cliente_id === c.id && g.tipo === "visita" &&
          ahora.getTime() - new Date(g.created_at).getTime() < 10 * 86_400_000
        );

        for (const visita of visitasRecientes) {
          const visitaFecha = new Date(visita.created_at);
          const deadline = addBusinessHours(visitaFecha, 24);

          if (ahora > deadline) {
            const tieneContacto = gestionesArr.some(
              (g) =>
                g.cliente_id === c.id &&
                g.tipo !== "visita" &&
                new Date(g.created_at) > visitaFecha &&
                new Date(g.created_at) <= deadline
            );
            if (!tieneContacto) { vContactos++; break; }
          }
        }
      }

      setVisitasVencidas(vVisitas);
      setContactosVencidos(vContactos);
      if (canManage) {
        setEquipoKpis((prev) => ({ ...prev, visitasVencidasEquipo: vVisitas, contactosVencidosEquipo: vContactos }));
      }
    }

    // ── Vencimientos próximos (30 días) ─────────────────────
    const hoy30 = new Date();
    hoy30.setDate(hoy30.getDate() + 30);
    const hoyStr = new Date().toISOString().split("T")[0];
    let vencQuery = supabase
      .from("clientes")
      .select("id, nombre_comercial, ciudad, fecha_vencimiento, instancia, ejecutivo:ejecutivo_id(nombre, apellido)")
      .eq("activo", true)
      .not("instancia", "eq", "CENSO")
      .not("fecha_vencimiento", "is", null)
      .lte("fecha_vencimiento", hoy30.toISOString().split("T")[0])
      .order("fecha_vencimiento");

    if (!canManage) vencQuery = vencQuery.eq("ejecutivo_id", user!.id);

    const { data: vencData } = await vencQuery;
    setProximosVencimientos(vencData ?? []);

    setLoading(false);
  };

  const montoMeta = meta?.monto_meta ?? 0;
  const metaTotal = montoMeta + deficitAnterior;
  const pct = metaTotal > 0 ? Math.round((cobradoMes / metaTotal) * 100) : 0;
  const goalColor = pct < 60 ? "text-destructive" : pct < 85 ? "text-warning" : "text-success";
  const goalBar = pct < 60 ? "bg-destructive" : pct < 85 ? "bg-warning" : "bg-success";

  const nombre = profile?.nombre ?? nombreCompleto?.split(" ")[0] ?? "!";
  const hayAlertas = visitasVencidas > 0 || contactosVencidos > 0;

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
        <div className="space-y-5 px-4 pt-5 pb-8">

          {/* Dashboard del equipo — solo canManage */}
          {canManage && (
            <section className="animate-fade-in rounded-2xl gradient-primary p-5 text-primary-foreground shadow-elevated">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Resumen del equipo</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{formatPYG(equipoKpis.totalCobrado)}</p>
                  {equipoKpis.totalMeta > 0 ? (
                    <p className="text-xs text-primary-foreground/70">
                      de {formatPYG(equipoKpis.totalMeta)} en meta —{" "}
                      <span className="font-bold text-accent">
                        {Math.round((equipoKpis.totalCobrado / equipoKpis.totalMeta) * 100)}%
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-primary-foreground/70">Sin metas asignadas este mes</p>
                  )}
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/20 text-accent">
                  <BarChart2 className="h-7 w-7" />
                </div>
              </div>

              {equipoKpis.totalMeta > 0 && (
                <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full gradient-accent"
                    style={{ width: `${Math.min(Math.round((equipoKpis.totalCobrado / equipoKpis.totalMeta) * 100), 100)}%` }}
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white/10 py-2.5">
                  <p className="text-lg font-bold tabular-nums">{equipoKpis.totalClientes}</p>
                  <p className="text-[10px] font-semibold text-primary-foreground/70 uppercase tracking-wide">Clientes</p>
                </div>
                <div className="rounded-xl bg-white/10 py-2.5">
                  <p className="text-lg font-bold tabular-nums">{equipoKpis.totalEjecutivos}</p>
                  <p className="text-[10px] font-semibold text-primary-foreground/70 uppercase tracking-wide">Ejecutivos</p>
                </div>
                <Link to="/app/admin" className="rounded-xl bg-white/10 py-2.5 block hover:bg-white/20 transition-smooth">
                  <p className={cn("text-lg font-bold tabular-nums", (equipoKpis.visitasVencidasEquipo + equipoKpis.contactosVencidosEquipo) > 0 ? "text-red-300" : "")}>
                    {equipoKpis.visitasVencidasEquipo + equipoKpis.contactosVencidosEquipo}
                  </p>
                  <p className="text-[10px] font-semibold text-primary-foreground/70 uppercase tracking-wide">Alertas</p>
                </Link>
              </div>
            </section>
          )}

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

          {/* ⚠️ Alertas de vencimiento */}
          {hayAlertas && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h2 className="text-sm font-bold text-destructive">Alertas de gestión</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Visitas vencidas */}
                <button
                  onClick={() => navigate("/app/alertas?tipo=visitas")}
                  className={cn(
                    "rounded-2xl border p-4 text-left shadow-card transition-smooth active:scale-[0.98]",
                    visitasVencidas > 0
                      ? "border-destructive/40 bg-destructive/5 hover:border-destructive/70"
                      : "border-border bg-card"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", visitasVencidas > 0 ? "bg-destructive/15" : "bg-secondary")}>
                      <AlertTriangle className={cn("h-4 w-4", visitasVencidas > 0 ? "text-destructive" : "text-muted-foreground")} />
                    </div>
                    {visitasVencidas > 0 && (
                      <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white">{visitasVencidas}</span>
                    )}
                  </div>
                  <p className={cn("mt-2 text-lg font-bold tabular-nums", visitasVencidas > 0 ? "text-destructive" : "text-foreground")}>
                    {visitasVencidas}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Visitas Vencidas</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Clientes sin visita en plazo</p>
                </button>

                {/* Contactos vencidos */}
                <button
                  onClick={() => navigate("/app/alertas?tipo=contactos")}
                  className={cn(
                    "rounded-2xl border p-4 text-left shadow-card transition-smooth active:scale-[0.98]",
                    contactosVencidos > 0
                      ? "border-warning/40 bg-warning/5 hover:border-warning/70"
                      : "border-border bg-card"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", contactosVencidos > 0 ? "bg-warning/15" : "bg-secondary")}>
                      <PhoneCall className={cn("h-4 w-4", contactosVencidos > 0 ? "text-warning" : "text-muted-foreground")} />
                    </div>
                    {contactosVencidos > 0 && (
                      <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-white">{contactosVencidos}</span>
                    )}
                  </div>
                  <p className={cn("mt-2 text-lg font-bold tabular-nums", contactosVencidos > 0 ? "text-warning" : "text-foreground")}>
                    {contactosVencidos}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contactos Vencidos</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Visitas sin seguimiento 24h</p>
                </button>
              </div>
            </section>
          )}

          {/* Vencimientos próximos de licencias */}
          {proximosVencimientos.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">Licencias por vencer</h2>
                <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                  {proximosVencimientos.length}
                </span>
              </div>
              <div className="space-y-2">
                {proximosVencimientos.map((c) => {
                  const fv = new Date(c.fecha_vencimiento + "T00:00:00");
                  const hoy = new Date();
                  const diasRestantes = Math.ceil((fv.getTime() - hoy.getTime()) / 86_400_000);
                  const vencido = diasRestantes < 0;
                  const urgente = diasRestantes <= 7;

                  return (
                    <Link
                      key={c.id}
                      to={`/app/clientes/${c.id}`}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-3.5 shadow-card transition-smooth active:scale-[0.99]",
                        vencido
                          ? "border-destructive/40 bg-destructive/5"
                          : urgente
                          ? "border-warning/40 bg-warning/5"
                          : "border-border bg-card hover:border-primary/30"
                      )}
                    >
                      <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        vencido ? "bg-destructive/15" : urgente ? "bg-warning/15" : "bg-secondary"
                      )}>
                        <CalendarClock className={cn(
                          "h-5 w-5",
                          vencido ? "text-destructive" : urgente ? "text-warning" : "text-primary"
                        )} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{c.nombre_comercial}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {c.ciudad && `${c.ciudad} · `}
                          {fv.toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                        {canManage && c.ejecutivo && (
                          <p className="text-[10px] font-semibold text-primary mt-0.5">
                            {`${c.ejecutivo.nombre ?? ""} ${c.ejecutivo.apellido ?? ""}`.trim()}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={cn(
                          "block rounded-full px-2.5 py-1 text-[10px] font-bold",
                          vencido
                            ? "bg-destructive/15 text-destructive"
                            : urgente
                            ? "bg-warning/15 text-warning"
                            : "bg-primary/10 text-primary"
                        )}>
                          {vencido
                            ? `${Math.abs(diasRestantes)}d vencida`
                            : diasRestantes === 0
                            ? "Vence hoy"
                            : `${diasRestantes}d`}
                        </span>
                        <ChevronRight className="mt-1 h-3.5 w-3.5 text-muted-foreground ml-auto" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

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
