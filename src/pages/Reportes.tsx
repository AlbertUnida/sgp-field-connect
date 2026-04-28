import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Trophy, Users, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { formatPYG } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";

const MES_ACTUAL = new Date().getMonth() + 1;
const ANIO_ACTUAL = new Date().getFullYear();
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

const INSTANCIA_CONFIG: Record<string, { label: string; color: string }> = {
  CENSO:      { label: "Censo",      color: "#6b7280" },
  COMERCIAL:  { label: "Comercial",  color: "#3b82f6" },
  COBRANZAS:  { label: "Cobranzas", color: "#22c55e" },
  JURIDICO:   { label: "Jurídico",   color: "#ef4444" },
};

const Reportes = () => {
  const { user } = useAuth();
  const { isAdmin, canManage } = useProfile();
  const [loading, setLoading] = useState(true);
  const [ejecutivos, setEjecutivos] = useState<EjecutivoStats[]>([]);
  const [embudo, setEmbudo] = useState<InstanciaCount[]>([]);

  useEffect(() => {
    if (!user) return;
    cargarDatos();
  }, [user, canManage]);

  const cargarDatos = async () => {
    setLoading(true);

    const primerDia = `${ANIO_ACTUAL}-${String(MES_ACTUAL).padStart(2, "0")}-01`;

    // Si no es admin ni supervisor, solo se ve a sí mismo
    if (!canManage) {
      const [{ data: metaData }, { data: cobrosData }, { data: clientesData }, { data: perfil }] = await Promise.all([
        supabase.from("metas").select("monto_meta")
          .eq("ejecutivo_id", user!.id).eq("mes", MES_ACTUAL).eq("anio", ANIO_ACTUAL).maybeSingle(),
        supabase.from("cobros").select("monto")
          .eq("ejecutivo_id", user!.id).gte("fecha_cobro", primerDia),
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
          .eq("mes", MES_ACTUAL).eq("anio", ANIO_ACTUAL),
        supabase.from("cobros").select("ejecutivo_id, monto")
          .gte("fecha_cobro", primerDia),
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

    setLoading(false);
  };

  const totalMeta = ejecutivos.reduce((s, e) => s + e.meta, 0);
  const totalCobrado = ejecutivos.reduce((s, e) => s + e.cobrado, 0);
  const teamPct = totalMeta > 0 ? Math.round((totalCobrado / totalMeta) * 100) : 0;
  const totalClientes = embudo.reduce((s, e) => s + e.count, 0);

  const sortedExec = [...ejecutivos].sort((a, b) => b.cobrado - a.cobrado);

  return (
    <>
      <AppHeader
        title="Reportes"
        subtitle={`${MESES[MES_ACTUAL - 1]} ${ANIO_ACTUAL}`}
      />

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
                  <p className="text-xs text-primary-foreground/70">Sin meta asignada este mes</p>
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
                <p className="mt-2 text-xs font-bold text-accent">{teamPct}% de la meta {canManage ? "global" : "mensual"}</p>
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
    </>
  );
};

export default Reportes;
