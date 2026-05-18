import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Receipt, User, Filter, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { AppHeader } from "@/components/AppHeader";
import { formatPYG } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { ExportModal, RangoFecha } from "@/components/ExportModal";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

interface Cobro {
  id: string;
  monto: number;
  metodo_pago: string | null;
  modalidad: string | null;
  fecha_cobro: string;
  periodo_desde: string | null;
  periodo_hasta: string | null;
  notas: string | null;
  cliente_nombre: string;
  cliente_rubro: string | null;
  ejecutivo_nombre: string;
  ejecutivo_id: string;
}

interface EjecutivoOption {
  id: string;
  nombre: string;
  apellido: string | null;
}

const METODO_COLORS: Record<string, string> = {
  efectivo:      "bg-green-100 text-green-700",
  transferencia: "bg-blue-100 text-blue-700",
  cheque:        "bg-amber-100 text-amber-700",
};

const mapCobros = (data: any[]): Cobro[] =>
  data.map((c) => ({
    id: c.id,
    monto: c.monto,
    metodo_pago: c.metodo_pago,
    modalidad: c.modalidad,
    fecha_cobro: c.fecha_cobro,
    periodo_desde: c.periodo_desde,
    periodo_hasta: c.periodo_hasta,
    notas: c.notas,
    cliente_nombre: c.cliente?.nombre_comercial ?? "—",
    cliente_rubro: c.cliente?.rubro ?? null,
    ejecutivo_id: c.ejecutivo?.id ?? "",
    ejecutivo_nombre: c.ejecutivo
      ? `${c.ejecutivo.nombre ?? ""} ${c.ejecutivo.apellido ?? ""}`.trim()
      : "—",
  }));

const Cobros = () => {
  const { user } = useAuth();
  const { canManage } = useProfile();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [ejecutivos, setEjecutivos] = useState<EjecutivoOption[]>([]);
  const [ejFilter, setEjFilter] = useState<string>("todos");
  const [showFilter, setShowFilter] = useState(false);
  const [showExport, setShowExport] = useState(false);

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

  // Cargar lista de ejecutivos para el filtro (solo canManage)
  useEffect(() => {
    if (!canManage) return;
    supabase
      .from("profiles")
      .select("id, nombre, apellido")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setEjecutivos(data ?? []));
  }, [canManage]);

  useEffect(() => {
    if (!user) return;
    cargarCobros();
  }, [user, canManage, mes, anio, ejFilter]);

  const buildQuery = (desde: string, hasta: string) => {
    // "hasta" es inclusivo: sumamos 1 día para el filtro lt
    const hastaDate = new Date(hasta + "T23:59:59");
    hastaDate.setDate(hastaDate.getDate() + 1);
    const hastaExclusivo = hastaDate.toISOString().slice(0, 10);

    let q = supabase
      .from("cobros")
      .select(`
        id, monto, metodo_pago, modalidad, fecha_cobro,
        periodo_desde, periodo_hasta, notas,
        cliente:cliente_id(nombre_comercial, rubro),
        ejecutivo:ejecutivo_id(id, nombre, apellido)
      `)
      .gte("fecha_cobro", desde)
      .lt("fecha_cobro", hastaExclusivo)
      .order("fecha_cobro", { ascending: false });

    if (!canManage) {
      q = q.eq("ejecutivo_id", user!.id);
    } else if (ejFilter !== "todos") {
      q = q.eq("ejecutivo_id", ejFilter);
    }
    return q;
  };

  const cargarCobros = async () => {
    setLoading(true);
    const primerDia = `${anio}-${String(mes).padStart(2, "0")}-01`;
    const mesNext = mes === 12 ? 1 : mes + 1;
    const anioNext = mes === 12 ? anio + 1 : anio;
    const ultimoDia = `${anioNext}-${String(mesNext).padStart(2, "0")}-01`;

    // Usamos el rango del mes actual de la pantalla
    let q = supabase
      .from("cobros")
      .select(`
        id, monto, metodo_pago, modalidad, fecha_cobro,
        periodo_desde, periodo_hasta, notas,
        cliente:cliente_id(nombre_comercial, rubro),
        ejecutivo:ejecutivo_id(id, nombre, apellido)
      `)
      .gte("fecha_cobro", primerDia)
      .lt("fecha_cobro", ultimoDia)
      .order("fecha_cobro", { ascending: false });

    if (!canManage) {
      q = q.eq("ejecutivo_id", user!.id);
    } else if (ejFilter !== "todos") {
      q = q.eq("ejecutivo_id", ejFilter);
    }

    const { data, error } = await q;
    if (error) console.error("Error cargando cobros:", error);
    setCobros(mapCobros(data ?? []));
    setLoading(false);
  };

  // Export con rango personalizado (consulta fresh)
  const handleExport = async (rango: RangoFecha) => {
    const { data } = await buildQuery(rango.desde, rango.hasta);
    const rows = mapCobros(data ?? []);

    const filtroNombre = ejFilter === "todos"
      ? "Todo el equipo"
      : ejecutivos.find((e) => e.id === ejFilter)
        ? `${ejecutivos.find((e) => e.id === ejFilter)!.nombre} ${ejecutivos.find((e) => e.id === ejFilter)!.apellido ?? ""}`.trim()
        : "Filtrado";

    const total = rows.reduce((s, c) => s + c.monto, 0);
    const wb = XLSX.utils.book_new();

    const encabezado = canManage
      ? ["Fecha", "Cliente", "Rubro", "Ejecutivo", "Monto (Gs.)", "Método de pago", "Modalidad", "Período desde", "Período hasta", "Notas"]
      : ["Fecha", "Cliente", "Rubro", "Monto (Gs.)", "Método de pago", "Modalidad", "Período desde", "Período hasta", "Notas"];

    const filas = rows.map((c) =>
      canManage
        ? [c.fecha_cobro, c.cliente_nombre, c.cliente_rubro ?? "", c.ejecutivo_nombre, c.monto, c.metodo_pago ?? "", c.modalidad ?? "", c.periodo_desde ?? "", c.periodo_hasta ?? "", c.notas ?? ""]
        : [c.fecha_cobro, c.cliente_nombre, c.cliente_rubro ?? "", c.monto, c.metodo_pago ?? "", c.modalidad ?? "", c.periodo_desde ?? "", c.periodo_hasta ?? "", c.notas ?? ""]
    );

    const wsData = [
      ["Cobros — SGP"],
      [`Período: ${rango.label}`, canManage ? `Ejecutivo: ${filtroNombre}` : ""],
      [`Total cobrado: ${formatPYG(total)}`, `Cantidad: ${rows.length} cobros`],
      [],
      encabezado,
      ...filas,
      [],
      ["TOTAL", "", canManage ? "" : "", total],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = canManage
      ? [{ wch: 14 }, { wch: 26 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 30 }]
      : [{ wch: 14 }, { wch: 26 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, "Cobros");

    XLSX.writeFile(wb, `SGP_Cobros_${rango.label.replace(/\s/g, "_")}.xlsx`);
  };

  const totalCobrado = cobros.reduce((sum, c) => sum + (c.monto ?? 0), 0);
  const ejNombre = ejFilter === "todos" ? null : ejecutivos.find((e) => e.id === ejFilter);

  const formatFecha = (iso: string) => {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("es-PY", { day: "2-digit", month: "short" });
  };

  const formatPeriodo = (desde: string | null, hasta: string | null) => {
    if (!desde && !hasta) return null;
    const d = desde ? new Date(desde + "T12:00:00").toLocaleDateString("es-PY", { month: "short", year: "2-digit" }) : "?";
    const h = hasta ? new Date(hasta + "T12:00:00").toLocaleDateString("es-PY", { month: "short", year: "2-digit" }) : "?";
    return `${d} → ${h}`;
  };

  return (
    <>
      <AppHeader
        title="Cobros"
        subtitle={loading ? "Cargando..." : `${cobros.length} cobros · ${formatPYG(totalCobrado)}`}
      />

      <div className="px-4 pt-4 pb-10 space-y-4">

        {/* Selector de mes */}
        <div className="sticky top-[72px] z-20 -mx-4 flex items-center justify-between bg-background/95 backdrop-blur px-4 py-2.5 border-b border-border">
          <button
            onClick={irMesAnterior}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold">
            {MESES[mes - 1]} {anio}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowExport(true)}
              title="Exportar Excel"
              className="flex h-9 w-9 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={irMesSiguiente}
              disabled={esMesActual}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Resumen + filtro ejecutivo */}
        <div className="rounded-2xl gradient-primary p-4 text-primary-foreground shadow-elevated">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary-foreground/60">
                Total cobrado
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {loading ? "..." : formatPYG(totalCobrado)}
              </p>
              {ejNombre && (
                <p className="mt-0.5 text-xs text-primary-foreground/70">
                  {ejNombre.nombre} {ejNombre.apellido ?? ""}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <Receipt className="h-6 w-6" />
              </div>
              {canManage && (
                <button
                  onClick={() => setShowFilter((v) => !v)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-colors",
                    ejFilter !== "todos"
                      ? "bg-accent text-accent-foreground"
                      : "bg-white/15 text-primary-foreground"
                  )}
                >
                  <Filter className="h-3 w-3" />
                  {ejFilter === "todos" ? "Todos" : (ejNombre ? `${ejNombre.nombre}` : "Filtrado")}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Selector ejecutivo (desplegable) */}
        {canManage && showFilter && (
          <div className="rounded-2xl border border-border bg-card p-3 shadow-card space-y-1">
            <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Filtrar por ejecutivo
            </p>
            {[{ id: "todos", nombre: "Todos los ejecutivos", apellido: null }, ...ejecutivos].map((ej) => (
              <button
                key={ej.id}
                onClick={() => { setEjFilter(ej.id); setShowFilter(false); }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  ejFilter === ej.id
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "hover:bg-muted font-medium"
                )}
              >
                <User className="h-4 w-4 shrink-0 opacity-60" />
                {ej.id === "todos" ? "Todos los ejecutivos" : `${ej.nombre} ${ej.apellido ?? ""}`.trim()}
              </button>
            ))}
          </div>
        )}

        {/* Lista de cobros */}
        {loading ? (
          <div className="flex justify-center pt-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : cobros.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Receipt className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold">Sin cobros en este período</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Probá navegando a otro mes
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {cobros.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{c.cliente_nombre}</p>
                    {c.cliente_rubro && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{c.cliente_rubro}</p>
                    )}
                    {canManage && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <User className="h-3 w-3" />
                        {c.ejecutivo_nombre}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-bold text-primary tabular-nums">
                      {formatPYG(c.monto)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatFecha(c.fecha_cobro)}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {c.metodo_pago && (
                    <span className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      METODO_COLORS[c.metodo_pago.toLowerCase()] ?? "bg-gray-100 text-gray-600"
                    )}>
                      {c.metodo_pago}
                    </span>
                  )}
                  {c.modalidad && (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {c.modalidad}
                    </span>
                  )}
                  {formatPeriodo(c.periodo_desde, c.periodo_hasta) && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                      {formatPeriodo(c.periodo_desde, c.periodo_hasta)}
                    </span>
                  )}
                </div>

                {c.notas && (
                  <p className="mt-2 text-[11px] text-muted-foreground italic border-t border-border pt-2">
                    {c.notas}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de exportación */}
      <ExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        onExport={handleExport}
        titulo="Exportar cobros"
      />
    </>
  );
};

export default Cobros;
