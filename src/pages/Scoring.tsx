import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2, ChevronRight, TrendingUp, User } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/hooks/useProfile";
import { getLeadScoreInfo, scoreClasses } from "@/lib/lead-score";
import type { ScoreCategory } from "@/lib/lead-score";
import { cn } from "@/lib/utils";

type Categoria = ScoreCategory | "sin_datos";

interface ClienteScore {
  id: number;
  nombre_comercial: string;
  instancia: string | null;
  tipo_cliente: string | null;
  ejecutivo_id: string | null;
  ejecutivo_nombre: string | null;
  lead_score: number | null;
  categoria: Categoria;
}

interface Ejecutivo {
  id: string;
  nombre: string;
}

const CATEGORIA_CONFIG: Record<Categoria, { label: string; emoji: string; chartColor: string; bg: string; text: string; border: string }> = {
  caliente:  { label: "Caliente",  emoji: "🟢", chartColor: "#22c55e", bg: "bg-green-50  dark:bg-green-900/20",  text: "text-green-700  dark:text-green-400",  border: "border-green-300  dark:border-green-700" },
  tibio:     { label: "Tibio",     emoji: "🟡", chartColor: "#eab308", bg: "bg-yellow-50 dark:bg-yellow-900/20", text: "text-yellow-700 dark:text-yellow-400", border: "border-yellow-300 dark:border-yellow-700" },
  neutro:    { label: "Neutro",    emoji: "⚪", chartColor: "#9ca3af", bg: "bg-gray-50   dark:bg-gray-800",      text: "text-gray-500   dark:text-gray-400",   border: "border-gray-300   dark:border-gray-600"  },
  frio:      { label: "Frío",      emoji: "🔴", chartColor: "#ef4444", bg: "bg-red-50   dark:bg-red-900/20",    text: "text-red-700   dark:text-red-400",     border: "border-red-300   dark:border-red-700"   },
  sin_datos: { label: "Sin datos", emoji: "⬜", chartColor: "#d1d5db", bg: "bg-gray-50   dark:bg-gray-800",      text: "text-gray-400   dark:text-gray-500",   border: "border-gray-200   dark:border-gray-700"  },
};

const ORDEN_CATEGORIAS: Categoria[] = ["caliente", "tibio", "neutro", "frio", "sin_datos"];

const INSTANCIA_COLORS: Record<string, string> = {
  CENSO:      "bg-gray-100 text-gray-600",
  COMERCIAL:  "bg-blue-100 text-blue-700",
  COBRANZAS:  "bg-green-100 text-green-700",
  JURIDICO:   "bg-red-100 text-red-700",
};

const Scoring = () => {
  const { isAdmin, canManage } = useProfile();

  const [clientes, setClientes] = useState<ClienteScore[]>([]);
  const [ejecutivos, setEjecutivos] = useState<Ejecutivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Categoria | null>(null);
  const [ejFilter, setEjFilter] = useState<string>("");

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [{ data: scores }, { data: clientesData }] = await Promise.all([
      supabase.from("cliente_lead_scores").select("cliente_id, lead_score"),
      supabase
        .from("clientes")
        .select("id, nombre_comercial, instancia, tipo_cliente, ejecutivo_id, ejecutivo:ejecutivo_id(nombre, apellido)")
        .eq("activo", true)
        .order("nombre_comercial"),
    ]);

    // Mapa score por cliente
    const scoreMap = new Map<string, number>(
      (scores ?? []).map((s: any) => [String(s.cliente_id), Number(s.lead_score)])
    );

    // Clientes con categoría asignada
    const conScore: ClienteScore[] = (clientesData ?? []).map((c: any) => {
      const score = scoreMap.has(String(c.id)) ? scoreMap.get(String(c.id))! : null;
      const categoria: Categoria = score !== null ? getLeadScoreInfo(score).category : "sin_datos";
      return {
        id: c.id,
        nombre_comercial: c.nombre_comercial,
        instancia: c.instancia ?? null,
        tipo_cliente: c.tipo_cliente ?? null,
        ejecutivo_id: c.ejecutivo_id ?? null,
        ejecutivo_nombre: c.ejecutivo
          ? `${c.ejecutivo.nombre ?? ""} ${c.ejecutivo.apellido ?? ""}`.trim()
          : null,
        lead_score: score,
        categoria,
      };
    });

    setClientes(conScore);

    // Lista de ejecutivos únicos con clientes
    const ejMap = new Map<string, string>();
    conScore.forEach((c) => {
      if (c.ejecutivo_id && c.ejecutivo_nombre) ejMap.set(c.ejecutivo_id, c.ejecutivo_nombre);
    });
    setEjecutivos(Array.from(ejMap.entries()).map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre)));

    setLoading(false);
  };

  // Clientes filtrados por ejecutivo
  const clientesFiltrados = useMemo(() =>
    ejFilter ? clientes.filter((c) => c.ejecutivo_id === ejFilter) : clientes,
    [clientes, ejFilter]
  );

  // Conteos por categoría
  const counts = useMemo(() => {
    const r: Record<Categoria, number> = { caliente: 0, tibio: 0, neutro: 0, frio: 0, sin_datos: 0 };
    clientesFiltrados.forEach((c) => r[c.categoria]++);
    return r;
  }, [clientesFiltrados]);

  const total = clientesFiltrados.length;

  // Datos para el donut
  const chartData = ORDEN_CATEGORIAS
    .filter((cat) => counts[cat] > 0)
    .map((cat) => ({ cat, name: CATEGORIA_CONFIG[cat].label, value: counts[cat], color: CATEGORIA_CONFIG[cat].chartColor }));

  // Clientes de la categoría seleccionada, ordenados por score desc
  const clientesSeleccionados = useMemo(() => {
    if (!selected) return [];
    return clientesFiltrados
      .filter((c) => c.categoria === selected)
      .sort((a, b) => (b.lead_score ?? -999) - (a.lead_score ?? -999));
  }, [clientesFiltrados, selected]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selCfg = selected ? CATEGORIA_CONFIG[selected] : null;

  return (
    <>
      <AppHeader
        title="Lead Scoring"
        subtitle={`${total} clientes${ejFilter ? " · filtrado por ejecutivo" : ""}`}
      />

      <div className="px-4 pt-4 pb-10 space-y-4">

        {/* Filtro por ejecutivo (solo admin/supervisor) */}
        {isAdmin && ejecutivos.length > 0 && (
          <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <div className="flex gap-2 items-center">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ejecutivo:</span>
              <FilterChip active={ejFilter === ""} onClick={() => setEjFilter("")}>Todos</FilterChip>
              {ejecutivos.map((ej) => (
                <FilterChip key={ej.id} active={ejFilter === ej.id} onClick={() => { setEjFilter(ej.id); setSelected(null); }}>
                  {ej.nombre}
                </FilterChip>
              ))}
            </div>
          </div>
        )}

        {/* ── 4 tarjetas métricas ── */}
        <div className="grid grid-cols-2 gap-3">
          {ORDEN_CATEGORIAS.map((cat) => {
            const cfg = CATEGORIA_CONFIG[cat];
            const count = counts[cat];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const isActive = selected === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelected(isActive ? null : cat)}
                className={cn(
                  "rounded-2xl border-2 p-4 text-left transition-all",
                  cfg.bg,
                  isActive ? cfg.border + " shadow-md scale-[1.02]" : "border-transparent opacity-80 hover:opacity-100"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">{cfg.emoji}</span>
                  {isActive && <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Seleccionado</span>}
                </div>
                <p className={cn("mt-2 text-2xl font-black tabular-nums", cfg.text)}>{count}</p>
                <p className={cn("text-xs font-semibold", cfg.text)}>{cfg.label}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{pct}% del total</p>
              </button>
            );
          })}
        </div>

        {/* ── Gráfico donut ── */}
        {total > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold">Distribución de cartera</h2>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  onClick={(entry) => {
                    const cat = entry.cat as Categoria;
                    setSelected(selected === cat ? null : cat);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.cat}
                      fill={entry.color}
                      opacity={selected === null || selected === entry.cat ? 1 : 0.35}
                      stroke={selected === entry.cat ? "#1e293b" : "transparent"}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} clientes`, name]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Leyenda */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-1">
              {chartData.map((entry) => (
                <button
                  key={entry.cat}
                  onClick={() => setSelected(selected === entry.cat ? null : entry.cat)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold"
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className={selected === entry.cat ? "text-foreground" : "text-muted-foreground"}>
                    {entry.name} ({entry.value})
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Lista de clientes seleccionados ── */}
        {selected && (
          <section>
            <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2 mb-3", selCfg!.bg)}>
              <span className="text-base">{selCfg!.emoji}</span>
              <h2 className={cn("text-sm font-bold", selCfg!.text)}>
                {selCfg!.label} — {clientesSeleccionados.length} clientes
              </h2>
            </div>

            {clientesSeleccionados.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">Sin clientes en esta categoría</p>
            ) : (
              <div className="space-y-2">
                {clientesSeleccionados.map((c) => (
                  <Link
                    key={c.id}
                    to={`/app/clientes/${c.id}`}
                    className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-card hover:border-primary/40 transition-smooth"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{c.nombre_comercial}</p>
                      <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                        {c.instancia && (
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", INSTANCIA_COLORS[c.instancia] ?? "bg-gray-100 text-gray-600")}>
                            {c.instancia}
                          </span>
                        )}
                        {c.ejecutivo_nombre && (
                          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                            <User className="h-3 w-3" />{c.ejecutivo_nombre}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {c.lead_score !== null && (
                        <span className={cn("text-sm font-black tabular-nums", CATEGORIA_CONFIG[c.categoria].text)}>
                          {c.lead_score > 0 ? "+" : ""}{c.lead_score} pts
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Estado vacío */}
        {total === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-semibold">Sin datos de scoring aún</p>
            <p className="mt-1 text-xs text-muted-foreground">Los scores se generan al registrar gestiones con Resultado</p>
          </div>
        )}

      </div>
    </>
  );
};

const FilterChip = ({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-smooth",
      active
        ? "border-primary bg-primary text-primary-foreground shadow-card"
        : "border-border bg-card text-muted-foreground hover:border-primary/40"
    )}
  >
    {children}
  </button>
);

export default Scoring;
