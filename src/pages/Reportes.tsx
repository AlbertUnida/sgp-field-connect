import { TrendingUp, TrendingDown, Trophy, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EJECUTIVOS_PERFORMANCE, FUNNEL_DATA, STAGES, formatPYG } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const Reportes = () => {
  const sortedExec = [...EJECUTIVOS_PERFORMANCE].sort((a, b) => b.ejecutado - a.ejecutado);
  const totalGoal = EJECUTIVOS_PERFORMANCE.reduce((s, e) => s + e.goal, 0);
  const totalExec = EJECUTIVOS_PERFORMANCE.reduce((s, e) => s + e.ejecutado, 0);
  const teamPct = Math.round((totalExec / totalGoal) * 100);

  return (
    <>
      <AppHeader title="Reportes" subtitle="Performance del equipo · Marzo 2026" />

      <div className="space-y-5 px-4 pt-5">
        {/* Team summary */}
        <section className="rounded-2xl gradient-primary p-5 text-primary-foreground shadow-elevated">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Equipo total</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatPYG(totalExec)}</p>
              <p className="text-xs text-primary-foreground/70">de {formatPYG(totalGoal)}</p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/20 text-accent">
              <Trophy className="h-7 w-7" />
            </div>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full gradient-accent" style={{ width: `${Math.min(teamPct, 100)}%` }} />
          </div>
          <p className="mt-2 text-xs font-bold text-accent">{teamPct}% de la meta global</p>
        </section>

        {/* Funnel */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Embudo de conversión</h2>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">7 etapas</span>
          </div>
          <div className="mt-4 space-y-1.5">
            {STAGES.slice(0, 7).map((s, i) => {
              const data = FUNNEL_DATA.find((d) => d.color === s.key);
              const count = data?.count ?? 0;
              const max = Math.max(...FUNNEL_DATA.map((d) => d.count));
              const w = 30 + ((count / max) * 70);
              return (
                <div key={s.key} className="flex justify-center">
                  <div
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-bold text-white shadow-sm"
                    style={{ width: `${w}%`, backgroundColor: `hsl(var(--stage-${s.key}))` }}
                  >
                    <span>{s.label}</span>
                    <span className="tabular-nums">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Ejecutivos */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Performance por ejecutivo</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <Users className="h-3 w-3" /> {sortedExec.length}
            </span>
          </div>
          <div className="space-y-2.5">
            {sortedExec.map((e, i) => {
              const pct = Math.round((e.ejecutado / e.goal) * 100);
              const isTop = i === 0;
              const isBottom = i === sortedExec.length - 1;
              const tone = pct >= 100 ? "success" : pct >= 85 ? "success" : pct >= 60 ? "warning" : "destructive";
              return (
                <div key={e.nombre} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold",
                        isTop ? "gradient-accent text-accent-foreground" : "bg-secondary text-foreground",
                      )}>
                        {e.nombre.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{e.nombre}</p>
                        <p className="text-[11px] text-muted-foreground">{e.clientes} clientes activos</p>
                      </div>
                    </div>
                    {isTop && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase text-success">Top</span>}
                    {isBottom && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">Atención</span>}
                  </div>

                  <div className="mt-3">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-bold tabular-nums">{formatPYG(e.ejecutado)}</span>
                      <span className="text-muted-foreground">/ {formatPYG(e.goal)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          tone === "success" && "bg-success",
                          tone === "warning" && "bg-warning",
                          tone === "destructive" && "bg-destructive",
                        )}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px]">
                      <span className={cn(
                        "inline-flex items-center gap-0.5 font-bold",
                        tone === "success" && "text-success",
                        tone === "warning" && "text-warning",
                        tone === "destructive" && "text-destructive",
                      )}>
                        {pct >= 100 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {pct}%
                      </span>
                      <span className="text-muted-foreground">
                        {pct >= 100 ? "Meta superada" : `Falta ${formatPYG(e.goal - e.ejecutado)}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
};

export default Reportes;
