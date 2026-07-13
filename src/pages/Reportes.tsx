import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Trophy, Users, Loader2, ChevronLeft, ChevronRight, Download, CalendarDays } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { formatPYG } from "@/lib/format";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx";
import { ExportModal, RangoFecha } from "@/components/ExportModal";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

interface EjecutivoStats {
  id: string;
  nombre: string;
  apellido: string | null;
  meta: number;
  cobrado: number;
  clientes: number;
}

interface InstanciaCount {
  instancia: string;
  count: number;
}

interface EventoMes {
  id: string;
  numero_evento: number;
  nombre_evento: string | null;
  fecha_evento: string | null;
  tipo_evento: string | null;
  tarifa_evento: number | null;
  estado: string;
  ejecutivo: { nombre: string; apellido: string } | null;
  cliente: { nombre_comercial: string } | null;
}

const INSTANCIA_CONFIG: Record<string, { label: string; color: string }> = {
  CENSO:      { label: "Censo",      color: "#6b7280" },
  COMERCIAL:  { label: "Comercial",  color: "#3b82f6" },
  COBRANZAS:  { label: "Cobranzas", color: "#22c55e" },
  JURIDICO:   { label: "Jurídico",   color: "#ef4444" },
};

const Reportes = () => {
  const { user } = useAuth();
  const { canManage } = useProfile();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [ejecutivos, setEjecutivos] = useState<EjecutivoStats[]>([]);
  const [embudo, setEmbudo] = useState<InstanciaCount[]>([]);
  const [eventosMes, setEventosMes] = useState<EventoMes[]>([]);

  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();
  const esMesActual = mes === mesActual && anio === anioActual;

  const irMesAnterior = () => {
    if (mes === 1) { setMes(12); setAnio((a) => a - 1); }
    else setMes((m) => m - 1);
  };
  const irMesSiguiente = () => {
    if (esMesActual) return;
    if (mes === 12) { setMes(1); setAnio((a) => a + 1); }
    else setMes((m) => m + 1);
  };

  useEffect(() => {
    if (!user) return;
    cargarDatos();
  }, [user, canManage, mes, anio]);

  const cargarDatos = async () => {
    setLoading(true);

    const primerDia = `${anio}-${String(mes).padStart(2, "0")}-01`;
    // Primer día del mes siguiente como límite superior (exclusive)
    const mesNext = mes === 12 ? 1 : mes + 1;
    const anioNext = mes === 12 ? anio + 1 : anio;
    const primerDiaSiguiente = `${anioNext}-${String(mesNext).padStart(2, "0")}-01`;

    // Si no es admin ni supervisor, solo se ve a sí mismo
    if (!canManage) {
      const [{ data: metaData }, { data: cobrosData }, { data: clientesData }, { data: perfil }] = await Promise.all([
        supabase.from("metas").select("monto_meta")
          .eq("ejecutivo_id", user!.id).eq("mes", mes).eq("anio", anio).maybeSingle(),
        supabase.from("cobros").select("monto")
          .eq("ejecutivo_id", user!.id)
          .gte("fecha_cobro", primerDia)
          .lt("fecha_cobro", primerDiaSiguiente),
        supabase.from("clientes").select("id", { count: "exact", head: true })
          .eq("ejecutivo_id", user!.id).eq("activo", true),
        supabase.from("profiles").select("nombre, apellido").eq("id", user!.id).single(),
      ]);

      const cobrado = cobrosData?.reduce((s, c) => s + (c.monto || 0), 0) ?? 0;
      setEjecutivos([{
        id: user!.id,
        nombre: perfil?.nombre ?? "—",
        apellido: perfil?.apellido ?? null,
        meta: metaData?.monto_meta ?? 0,
        cobrado,
        clientes: (clientesData as any)?.count ?? 0,
      }]);
    } else {
      // Admin y supervisor ven todo el equipo
      const [{ data: perfiles }, { data: metas }, { data: cobros }, { data: clientesCounts }] = await Promise.all([
        supabase.from("profiles").select("id, nombre, apellido")
          .in("rol", ["ejecutivo", "supervisor"]).eq("activo", true).order("nombre"),
        supabase.from("metas").select("ejecutivo_id, monto_meta")
          .eq("mes", mes).eq("anio", anio),
        supabase.from("cobros").select("ejecutivo_id, monto")
          .gte("fecha_cobro", primerDia)
          .lt("fecha_cobro", primerDiaSiguiente),
        supabase.from("clientes").select("ejecutivo_id")
          .eq("activo", true).not("ejecutivo_id", "is", null),
      ]);

      const metaMap: Record<string, number> = {};
      metas?.forEach((m) => { metaMap[m.ejecutivo_id] = m.monto_meta; });

      const cobradoMap: Record<string, number> = {};
      cobros?.forEach((c) => {
        cobradoMap[c.ejecutivo_id] = (cobradoMap[c.ejecutivo_id] ?? 0) + (c.monto || 0);
      });

      const clientesMap: Record<string, number> = {};
      clientesCounts?.forEach((c) => {
        clientesMap[c.ejecutivo_id] = (clientesMap[c.ejecutivo_id] ?? 0) + 1;
      });

      setEjecutivos(
        (perfiles ?? []).map((p) => ({
          id: p.id,
          nombre: p.nombre ?? "—",
          apellido: p.apellido ?? null,
          meta: metaMap[p.id] ?? 0,
          cobrado: cobradoMap[p.id] ?? 0,
          clientes: clientesMap[p.id] ?? 0,
        }))
      );
    }

    // Embudo por instancia (todos)
    const { data: clientesPorInstancia } = await supabase
      .from("clientes")
      .select("instancia")
      .eq("activo", true);

    const counts: Record<string, number> = { CENSO: 0, COMERCIAL: 0, COBRANZAS: 0, JURIDICO: 0 };
    clientesPorInstancia?.forEach((c) => {
      const inst = c.instancia ?? "CENSO";
      if (counts[inst] !== undefined) counts[inst]++;
    });
    setEmbudo(Object.entries(counts).map(([instancia, count]) => ({ instancia, count })));

    // Eventos del mes
    const { data: eventosData } = await supabase
      .from("eventos_agenda")
      .select("id, numero_evento, nombre_evento, fecha_evento, tipo_evento, tarifa_evento, estado, ejecutivo:ejecutivo_id(nombre, apellido), cliente:cliente_id(nombre_comercial)")
      .gte("fecha_evento", primerDia)
      .lt("fecha_evento", primerDiaSiguiente)
      .order("fecha_evento");
    setEventosMes((eventosData ?? []) as unknown as EventoMes[]);

    setLoading(false);
  };

  const totalMeta = ejecutivos.reduce((s, e) => s + e.meta, 0);
  const totalCobrado = ejecutivos.reduce((s, e) => s + e.cobrado, 0);
  const teamPct = totalMeta > 0 ? Math.round((totalCobrado / totalMeta) * 100) : 0;
  const totalClientes = embudo.reduce((s, e) => s + e.count, 0);

  const sortedExec = [...ejecutivos].sort((a, b) => b.cobrado - a.cobrado);
  const [showExport, setShowExport] = useState(false);

  const handleExport = async (rango: RangoFecha) => {
    // Rango: hasta es inclusivo, convertimos a exclusivo para el filtro lt
    const hastaDate = new Date(rango.hasta + "T23:59:59");
    hastaDate.setDate(hastaDate.getDate() + 1);
    const hastaExclusivo = hastaDate.toISOString().slice(0, 10);

    // ── Consultas paralelas ──────────────────────────────────────
    const [
      { data: gestionesData },
      { data: cobrosData },
      { data: perfilesData },
      { data: carteraData },
      { data: eventosExportData },
    ] = await Promise.all([
      // Gestiones del período (visita, llamada, email, whatsapp)
      supabase
        .from("gestiones")
        .select(`
          fecha_inicio, tipo, resultado, nota, ejecutivo_id,
          ejecutivo:ejecutivo_id(nombre, apellido),
          cliente:cliente_id(nombre_comercial, rubro_id, rubro_rel:rubro_id(nombre))
        `)
        .gte("fecha_inicio", rango.desde)
        .lt("fecha_inicio", hastaExclusivo)
        .order("fecha_inicio", { ascending: false }),

      // Cobros del período
      supabase
        .from("cobros")
        .select("ejecutivo_id, cliente_id, monto, fecha_cobro, metodo_pago, modalidad, periodo_desde, periodo_hasta, notas, cliente:cliente_id(nombre_comercial, rubro_id, rubro_rel:rubro_id(nombre)), ejecutivo:ejecutivo_id(nombre, apellido)")
        .gte("fecha_cobro", rango.desde)
        .lt("fecha_cobro", hastaExclusivo),

      // Perfiles activos (ejecutivos/supervisores)
      supabase
        .from("profiles")
        .select("id, nombre, apellido")
        .in("rol", ["ejecutivo", "supervisor"])
        .eq("activo", true)
        .order("nombre"),

      // Cartera asignada por ejecutivo (COMERCIAL + COBRANZAS + JURIDICO)
      supabase
        .from("clientes")
        .select("ejecutivo_id")
        .eq("activo", true)
        .not("ejecutivo_id", "is", null),

      // Eventos del período
      supabase
        .from("eventos_agenda")
        .select("id, numero_evento, nombre_evento, fecha_evento, tipo_evento, tarifa_evento, estado, notas, ejecutivo:ejecutivo_id(nombre, apellido), cliente:cliente_id(nombre_comercial)")
        .gte("fecha_evento", rango.desde)
        .lt("fecha_evento", hastaExclusivo)
        .order("fecha_evento"),
    ]);

    const getRubro = (c: any) =>
      c?.rubro_rel?.nombre ?? c?.rubro ?? "Sin rubro";

    const nombreEjec = (e: any) =>
      e ? `${e.nombre ?? ""} ${e.apellido ?? ""}`.trim() : "—";

    // ── Índices para cálculo por ejecutivo ───────────────────────
    // Cartera total por ejecutivo
    const carteraMap: Record<string, number> = {};
    (carteraData ?? []).forEach((c: any) => {
      if (c.ejecutivo_id) carteraMap[c.ejecutivo_id] = (carteraMap[c.ejecutivo_id] ?? 0) + 1;
    });

    // Clientes únicos visitados / contactados / gestionados por ejecutivo
    const visitadosMap: Record<string, Set<string>> = {};
    const contactadosMap: Record<string, Set<string>> = {};
    const gestionadosMap: Record<string, Set<string>> = {};

    (gestionesData ?? []).forEach((g: any) => {
      const eid = g.ejecutivo_id;
      const cid = g.cliente_id ?? g.cliente?.id;
      if (!eid || !cid) return;
      if (!gestionadosMap[eid]) gestionadosMap[eid] = new Set();
      gestionadosMap[eid].add(cid);
      if (g.tipo === "visita") {
        if (!visitadosMap[eid]) visitadosMap[eid] = new Set();
        visitadosMap[eid].add(cid);
      } else {
        if (!contactadosMap[eid]) contactadosMap[eid] = new Set();
        contactadosMap[eid].add(cid);
      }
    });

    // Clientes únicos cobrados por ejecutivo
    const cobradosClientesMap: Record<string, Set<string>> = {};
    const cobradoMontoMap: Record<string, number> = {};
    (cobrosData ?? []).forEach((c: any) => {
      const eid = c.ejecutivo_id;
      if (!eid) return;
      if (!cobradosClientesMap[eid]) cobradosClientesMap[eid] = new Set();
      if (c.cliente_id) cobradosClientesMap[eid].add(c.cliente_id);
      cobradoMontoMap[eid] = (cobradoMontoMap[eid] ?? 0) + (c.monto ?? 0);
    });

    const pct = (num: number, den: number) =>
      den > 0 ? `${Math.round((num / den) * 100)}%` : "—";

    const wb = XLSX.utils.book_new();

    // ── Hoja 1: Resumen de gestión por ejecutivo ──────────────────
    const execRows = (perfilesData ?? []).map((p: any) => {
      const nombre = [p.nombre, p.apellido].filter(Boolean).join(" ");
      const cartera   = carteraMap[p.id] ?? 0;
      const visitados = visitadosMap[p.id]?.size ?? 0;
      const contactados = contactadosMap[p.id]?.size ?? 0;
      const gestionados = gestionadosMap[p.id]?.size ?? 0;
      const cobrados  = cobradosClientesMap[p.id]?.size ?? 0;
      const cobradoGs = cobradoMontoMap[p.id] ?? 0;
      const e = ejecutivos.find((ex) => ex.id === p.id);
      return [
        nombre,
        cartera,
        visitados,
        contactados,
        gestionados,
        pct(gestionados, cartera),   // penetración
        cobrados,
        pct(cobrados, gestionados),  // conversión gestión → cobro
        cobradoGs,
        e?.meta ?? 0,
        e?.meta ? pct(cobradoGs, e.meta) : "Sin meta",
      ];
    }).sort((a: any[], b: any[]) => b[4] - a[4]); // orden por gestionados desc

    const totCartera    = execRows.reduce((s: number, r: any[]) => s + r[1], 0);
    const totVisitados  = execRows.reduce((s: number, r: any[]) => s + r[2], 0);
    const totContactados= execRows.reduce((s: number, r: any[]) => s + r[3], 0);
    const totGestionados= execRows.reduce((s: number, r: any[]) => s + r[4], 0);
    const totCobrados   = execRows.reduce((s: number, r: any[]) => s + r[6], 0);
    const totCobradoGs  = execRows.reduce((s: number, r: any[]) => s + r[8], 0);
    const totMeta       = ejecutivos.reduce((s, e) => s + e.meta, 0);

    const wsResumen = XLSX.utils.aoa_to_sheet([
      ["Reporte de Gestión Comercial — SGP"],
      [`Período: ${rango.label}`],
      [`Generado: ${new Date().toLocaleDateString("es-PY")}`],
      [],
      [
        "Ejecutivo",
        "Cartera asignada",
        "Clientes visitados",
        "Clientes contactados",
        "Total gestionados",
        "% Penetración cartera",
        "Clientes cobrados",
        "% Conversión gestión→cobro",
        "Monto cobrado (Gs.)",
        "Meta (Gs.)",
        "% Cumpl. meta",
      ],
      ...execRows,
      [],
      [
        "TOTAL EQUIPO",
        totCartera,
        totVisitados,
        totContactados,
        totGestionados,
        pct(totGestionados, totCartera),
        totCobrados,
        pct(totCobrados, totGestionados),
        totCobradoGs,
        totMeta,
        totMeta > 0 ? pct(totCobradoGs, totMeta) : "Sin meta",
      ],
    ]);
    wsResumen["!cols"] = [
      { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 18 },
      { wch: 22 }, { wch: 18 }, { wch: 26 }, { wch: 20 }, { wch: 16 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen gestión");

    // ── Hoja 2: Detalle de gestiones ─────────────────────────────
    const TIPO_LABEL: Record<string, string> = {
      visita: "Visita presencial",
      llamada: "Llamada",
      email: "Email",
      whatsapp: "WhatsApp",
    };

    const wsGestiones = XLSX.utils.aoa_to_sheet([
      ["Detalle de gestiones — " + rango.label],
      [],
      ["Fecha", "Ejecutivo", "Cliente", "Rubro", "Tipo de gestión", "Resultado", "Notas"],
      ...(gestionesData ?? []).map((g: any) => [
        g.fecha_inicio?.slice(0, 10) ?? "",
        nombreEjec(g.ejecutivo),
        g.cliente?.nombre_comercial ?? "—",
        getRubro(g.cliente),
        TIPO_LABEL[g.tipo] ?? g.tipo ?? "—",
        g.resultado ?? "",
        g.nota ?? "",
      ]),
    ]);
    wsGestiones["!cols"] = [
      { wch: 14 }, { wch: 22 }, { wch: 26 }, { wch: 20 },
      { wch: 20 }, { wch: 20 }, { wch: 36 },
    ];
    XLSX.utils.book_append_sheet(wb, wsGestiones, "Detalle gestiones");

    // ── Hoja 3: Cobros del período ────────────────────────────────
    const totalCobradoRango = (cobrosData ?? []).reduce((s: number, c: any) => s + (c.monto ?? 0), 0);
    const wsCobros = XLSX.utils.aoa_to_sheet([
      ["Cobros del período — " + rango.label],
      [`Total cobrado: ${formatPYG(totalCobradoRango)}`, `Cantidad: ${cobrosData?.length ?? 0} cobros`],
      [],
      ["Fecha", "Cliente", "Rubro", "Ejecutivo", "Monto (Gs.)", "Método de pago", "Modalidad", "Período desde", "Período hasta", "Notas"],
      ...(cobrosData ?? []).map((c: any) => [
        c.fecha_cobro,
        c.cliente?.nombre_comercial ?? "—",
        getRubro(c.cliente),
        nombreEjec(c.ejecutivo),
        c.monto,
        c.metodo_pago ?? "",
        c.modalidad ?? "",
        c.periodo_desde ?? "",
        c.periodo_hasta ?? "",
        c.notas ?? "",
      ]),
    ]);
    wsCobros["!cols"] = [
      { wch: 14 }, { wch: 26 }, { wch: 20 }, { wch: 22 },
      { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, wsCobros, "Cobros");

    // ── Hoja 4: Eventos del período ───────────────────────────────
    // Mapa: evento_id → monto cobrado (cruzando con cobrosData)
    const cobrosPorEvento: Record<string, number> = {};
    (cobrosData ?? []).forEach((c: any) => {
      if (!c.eventos_ids) return;
      (c.eventos_ids as string[]).forEach((eid) => {
        cobrosPorEvento[eid] = (cobrosPorEvento[eid] ?? 0) + (c.monto ?? 0);
      });
    });

    const totalTarifaEventos = (eventosExportData ?? []).reduce((s: number, ev: any) => s + (ev.tarifa_evento ?? 0), 0);
    const totalCobradoEventos = (eventosExportData ?? []).reduce((s: number, ev: any) => s + (cobrosPorEvento[ev.id] ?? 0), 0);

    const wsEventos = XLSX.utils.aoa_to_sheet([
      ["Reporte de Eventos — SGP"],
      [`Período: ${rango.label}`],
      [`Total eventos: ${eventosExportData?.length ?? 0}   |   Tarifa estimada: ${totalTarifaEventos.toLocaleString("es-PY")}   |   Total cobrado: ${totalCobradoEventos.toLocaleString("es-PY")}`],
      [],
      ["N°", "Cliente", "Nombre del evento", "Tipo", "Fecha", "Ejecutivo", "Tarifa (Gs.)", "Cobrado (Gs.)", "Estado", "Notas"],
      ...(eventosExportData ?? []).map((ev: any) => [
        ev.numero_evento,
        ev.cliente?.nombre_comercial ?? "—",
        ev.nombre_evento ?? "—",
        ev.tipo_evento ?? "—",
        ev.fecha_evento?.slice(0, 10) ?? "",
        nombreEjec(ev.ejecutivo),
        ev.tarifa_evento ?? 0,
        cobrosPorEvento[ev.id] ?? 0,
        ev.estado ?? "",
        ev.notas ?? "",
      ]),
    ]);
    wsEventos["!cols"] = [
      { wch: 6 }, { wch: 28 }, { wch: 28 }, { wch: 16 }, { wch: 14 },
      { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 36 },
    ];
    XLSX.utils.book_append_sheet(wb, wsEventos, "Eventos");

    XLSX.writeFile(wb, `SGP_Gestion_${rango.label.replace(/\s/g, "_")}.xlsx`);
  };

  return (
    <>
      <AppHeader title="Reportes" />

      {/* Selector de mes */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background sticky top-[56px] z-10">
        <button
          onClick={irMesAnterior}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold">{MESES[mes - 1]} {anio}</p>
          {esMesActual && (
            <p className="text-[10px] text-muted-foreground font-medium">Mes en curso</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canManage && !loading && (
            <button
              onClick={() => setShowExport(true)}
              title="Exportar Excel"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-emerald-600 active:scale-95 transition-transform hover:bg-emerald-50"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={irMesSiguiente}
            disabled={esMesActual}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground active:scale-95 transition-transform",
              esMesActual && "opacity-30 cursor-not-allowed"
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center pt-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5 px-4 pt-5 pb-8">

          {/* Resumen del equipo / propio */}
          <section className="rounded-2xl gradient-primary p-5 text-primary-foreground shadow-elevated">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                  {canManage ? "Equipo total" : "Mi desempeño"}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{formatPYG(totalCobrado)}</p>
                {totalMeta > 0 ? (
                  <p className="text-xs text-primary-foreground/70">de {formatPYG(totalMeta)} en meta</p>
                ) : (
                  <p className="text-xs text-primary-foreground/70">Sin meta asignada en {MESES[mes - 1]}</p>
                )}
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/20 text-accent">
                <Trophy className="h-7 w-7" />
              </div>
            </div>
            {totalMeta > 0 && (
              <>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full gradient-accent" style={{ width: `${Math.min(teamPct, 100)}%` }} />
                </div>
                <p className="mt-2 text-xs font-bold text-accent">{teamPct}% de la meta de {MESES[mes - 1]}</p>
              </>
            )}
          </section>

          {/* Embudo por instancia */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold">Cartera activa</h2>
              <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                {totalClientes} clientes
              </span>
            </div>
            <div className="space-y-2.5">
              {embudo.map(({ instancia, count }) => {
                const cfg = INSTANCIA_CONFIG[instancia] ?? { label: instancia, color: "#6b7280" };
                const pct = totalClientes > 0 ? Math.round((count / totalClientes) * 100) : 0;
                return (
                  <div key={instancia}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-bold">{cfg.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {count} <span className="text-[10px]">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Eventos del mes */}
          {eventosMes.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold">Eventos del mes</h2>
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                  {eventosMes.length} evento{eventosMes.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Resumen por estado */}
              {(() => {
                const ESTADO_CFG: Record<string, { label: string; color: string }> = {
                  prospecto:  { label: "Prospecto",  color: "bg-yellow-100 text-yellow-700" },
                  confirmado: { label: "Confirmado", color: "bg-blue-100 text-blue-700" },
                  cerrado:    { label: "Cerrado",    color: "bg-green-100 text-green-700" },
                  cancelado:  { label: "Cancelado",  color: "bg-red-100 text-red-700" },
                };
                const countEstado: Record<string, number> = {};
                let totalTarifa = 0;
                eventosMes.forEach((ev) => {
                  countEstado[ev.estado] = (countEstado[ev.estado] ?? 0) + 1;
                  totalTarifa += ev.tarifa_evento ?? 0;
                });
                return (
                  <>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {Object.entries(countEstado).map(([estado, cnt]) => {
                        const cfg = ESTADO_CFG[estado] ?? { label: estado, color: "bg-secondary text-foreground" };
                        return (
                          <span key={estado} className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", cfg.color)}>
                            {cfg.label}: {cnt}
                          </span>
                        );
                      })}
                    </div>
                    {totalTarifa > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Tarifa total estimada: <span className="font-bold text-foreground">{formatPYG(totalTarifa)}</span>
                      </p>
                    )}
                  </>
                );
              })()}

              {/* Lista de eventos */}
              <div className="mt-4 space-y-2">
                {eventosMes.map((ev) => {
                  const ESTADO_CFG: Record<string, { label: string; color: string }> = {
                    prospecto:  { label: "Prospecto",  color: "bg-yellow-100 text-yellow-700" },
                    confirmado: { label: "Confirmado", color: "bg-blue-100 text-blue-700" },
                    cerrado:    { label: "Cerrado",    color: "bg-green-100 text-green-700" },
                    cancelado:  { label: "Cancelado",  color: "bg-red-100 text-red-700" },
                  };
                  const cfg = ESTADO_CFG[ev.estado] ?? { label: ev.estado, color: "bg-secondary text-foreground" };
                  return (
                    <div key={ev.id} className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">
                          #{ev.numero_evento} · {ev.cliente?.nombre_comercial ?? "—"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {ev.nombre_evento ?? ev.tipo_evento ?? "Sin nombre"} · {ev.fecha_evento?.slice(0, 10) ?? "—"}
                        </p>
                        {ev.ejecutivo && (
                          <p className="text-[10px] text-muted-foreground/70">
                            {ev.ejecutivo.nombre} {ev.ejecutivo.apellido ?? ""}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", cfg.color)}>
                          {cfg.label}
                        </span>
                        {(ev.tarifa_evento ?? 0) > 0 && (
                          <span className="text-[11px] font-semibold tabular-nums">{formatPYG(ev.tarifa_evento!)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Performance por ejecutivo */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold">
                {canManage ? "Performance por ejecutivo" : "Mi rendimiento"}
              </h2>
              {canManage && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                  <Users className="h-3 w-3" /> {sortedExec.length}
                </span>
              )}
            </div>

            {sortedExec.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">Sin datos de ejecutivos para este mes</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {sortedExec.map((e, i) => {
                  const pct = e.meta > 0 ? Math.round((e.cobrado / e.meta) * 100) : 0;
                  const isTop = canManage && i === 0 && sortedExec.length > 1;
                  const isBottom = canManage && i === sortedExec.length - 1 && sortedExec.length > 1 && pct < 60;
                  const tone = pct >= 85 ? "success" : pct >= 60 ? "warning" : "destructive";
                  const nombreCompleto = [e.nombre, e.apellido].filter(Boolean).join(" ");
                  const iniciales = nombreCompleto.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

                  return (
                    <div key={e.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold",
                            isTop ? "gradient-accent text-accent-foreground" : "bg-secondary text-foreground",
                          )}>
                            {iniciales}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{nombreCompleto}</p>
                            <p className="text-[11px] text-muted-foreground">{e.clientes} clientes activos</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {isTop && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase text-success">Top</span>}
                          {isBottom && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">Atención</span>}
                        </div>
                      </div>

                      <div className="mt-3">
                        {e.meta > 0 ? (
                          <>
                            <div className="flex items-baseline justify-between text-xs">
                              <span className="font-bold tabular-nums">{formatPYG(e.cobrado)}</span>
                              <span className="text-muted-foreground">/ {formatPYG(e.meta)}</span>
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  tone === "success" && "bg-green-500",
                                  tone === "warning" && "bg-yellow-500",
                                  tone === "destructive" && "bg-red-500",
                                )}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <div className="mt-1.5 flex items-center justify-between text-[11px]">
                              <span className={cn(
                                "inline-flex items-center gap-0.5 font-bold",
                                tone === "success" && "text-green-600",
                                tone === "warning" && "text-yellow-600",
                                tone === "destructive" && "text-red-600",
                              )}>
                                {pct >= 100 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {pct}%
                              </span>
                              <span className="text-muted-foreground">
                                {pct >= 100 ? "✅ Meta superada" : `Falta ${formatPYG(Math.max(0, e.meta - e.cobrado))}`}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Sin meta asignada — cobrado: <span className="font-semibold text-foreground">{formatPYG(e.cobrado)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      <ExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        onExport={handleExport}
        titulo="Exportar reporte"
      />
    </>
  );
};

export default Reportes;
