import { Link } from "react-router-dom";
import { ArrowUpRight, Calendar, CheckCircle2, Clock, MapPin, Target, TrendingUp } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { StageBadge } from "@/components/StageBadge";
import { MOCK_CLIENTES, META_MENSUAL, FUNNEL_DATA, formatPYG, relativeDate, STAGES } from "@/lib/mock-data";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const Inicio = () => {
  const proximas = MOCK_CLIENTES.filter((c) => c.proximaAccion).slice(0, 4);
  const pct = Math.round((META_MENSUAL.ejecutado / (META_MENSUAL.goal + META_MENSUAL.deficitAnterior)) * 100);
  const goalColor = pct < 60 ? "text-destructive" : pct < 85 ? "text-warning" : "text-success";
  const goalBar = pct < 60 ? "bg-destructive" : pct < 85 ? "bg-warning" : "bg-success";

  return (
    <>
      <AppHeader title="Hola, Carlos 👋" subtitle="Marzo 2026 · 12 días restantes" />

      <div className="space-y-5 px-4 pt-5">
        {/* Goal card */}
        <section className="animate-fade-in rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Meta mensual</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{formatPYG(META_MENSUAL.ejecutado)}</p>
              <p className="text-xs text-muted-foreground">
                de <span className="font-semibold text-foreground">{formatPYG(META_MENSUAL.goal + META_MENSUAL.deficitAnterior)}</span>
              </p>
            </div>
            <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary", goalColor)}>
              <Target className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
              <div className={cn("h-full rounded-full transition-all", goalBar)} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={cn("font-bold", goalColor)}>{pct}% completado</span>
              <span className="text-muted-foreground">
                Déficit anterior: <span className="font-semibold text-destructive">{formatPYG(META_MENSUAL.deficitAnterior)}</span>
              </span>
            </div>
          </div>
        </section>

        {/* Quick stats */}
        <section className="grid grid-cols-3 gap-3">
          <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Conversión" value="34%" trend="+5%" tone="success" />
          <StatCard icon={<Clock className="h-4 w-4" />} label="Pendientes" value="7" trend="hoy" tone="warning" />
          <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Cerrados" value="12" trend="mes" tone="primary" />
        </section>

        {/* Funnel */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Embudo comercial</h2>
            <Link to="/app/reportes" className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary">
              Ver más <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-4 space-y-2.5">
            {STAGES.slice(0, 7).map((s) => {
              const data = FUNNEL_DATA.find((d) => d.color === s.key);
              const count = data?.count ?? 0;
              const max = Math.max(...FUNNEL_DATA.map((d) => d.count));
              const w = (count / max) * 100;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <div className="w-20 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{s.short}</span>
                  </div>
                  <div className="relative flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="flex h-7 items-center justify-end pr-2 rounded-full text-[11px] font-bold text-white transition-all"
                      style={{ width: `${w}%`, backgroundColor: `hsl(var(--stage-${s.key}))` }}
                    >
                      {count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Próximas acciones */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Próximas acciones</h2>
            <Link to="/app/clientes" className="text-xs font-semibold text-primary">Ver cartera</Link>
          </div>
          <div className="space-y-2.5">
            {proximas.map((c) => (
              <Link
                key={c.id}
                to={`/app/clientes/${c.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-card transition-smooth hover:border-primary/30 hover:shadow-elevated"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.nombre}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{c.ciudad}</span>
                    <span>·</span>
                    <span>{relativeDate(c.proximaAccion!)}</span>
                  </div>
                </div>
                <StageBadge stage={c.stage} />
              </Link>
            ))}
          </div>
        </section>
      </div>
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
