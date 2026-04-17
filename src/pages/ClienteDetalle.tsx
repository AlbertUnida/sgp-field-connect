import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, Building2, Calendar, ChevronRight, FileText, CheckCircle2 } from "lucide-react";
import { StageBadge } from "@/components/StageBadge";
import { Button } from "@/components/ui/button";
import { MOCK_CLIENTES, MOCK_GESTIONES, STAGES, formatPYG, formatDate, stageByKey } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const ClienteDetalle = () => {
  const { id } = useParams();
  const cliente = MOCK_CLIENTES.find((c) => c.id === id);

  if (!cliente) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Cliente no encontrado.</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/app/clientes">Volver</Link></Button>
      </div>
    );
  }

  const gestiones = MOCK_GESTIONES.filter((g) => g.clienteId === cliente.id);
  const currentStage = stageByKey(cliente.stage);

  return (
    <>
      <header className="gradient-hero text-primary-foreground">
        <div className="px-4 pb-6 pt-4">
          <Link to="/app/clientes" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">{cliente.rubro}</p>
            <h1 className="mt-1 text-xl font-bold leading-tight">{cliente.nombre}</h1>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <StageBadge stage={cliente.stage} size="md" />
            <span className="text-xs text-primary-foreground/70">Etapa {currentStage.num} de 9</span>
          </div>
        </div>
      </header>

      <div className="space-y-5 px-4 pt-5">
        {/* Info */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="space-y-3 text-sm">
            <Row icon={<MapPin className="h-4 w-4" />} label="Dirección" value={`${cliente.direccion}, ${cliente.ciudad}`} />
            <Row icon={<Phone className="h-4 w-4" />} label="Teléfono" value={cliente.telefono} />
            <Row icon={<Building2 className="h-4 w-4" />} label="Rubro" value={cliente.rubro} />
            <Row icon={<FileText className="h-4 w-4" />} label="Monto" value={formatPYG(cliente.monto)} valueClass="text-primary font-bold" />
          </div>
        </section>

        {/* Workflow progress */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="text-sm font-bold">Progreso del workflow</h2>
          <div className="mt-4 space-y-1.5">
            {STAGES.map((s) => {
              const isDone = s.num < currentStage.num;
              const isCurrent = s.num === currentStage.num;
              return (
                <div
                  key={s.key}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-2.5 transition-smooth",
                    isCurrent ? "border-primary/40 bg-primary/5" : "border-transparent",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      isDone && "bg-success text-success-foreground",
                      isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/15",
                      !isDone && !isCurrent && "bg-secondary text-muted-foreground",
                    )}
                  >
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : s.num}
                  </div>
                  <span className={cn("flex-1 text-sm", isCurrent ? "font-bold" : isDone ? "text-muted-foreground line-through" : "text-muted-foreground")}>
                    {s.label}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Actual</span>
                  )}
                </div>
              );
            })}
          </div>
          <Button className="mt-4 h-11 w-full font-semibold">
            Avanzar a "{STAGES[Math.min(currentStage.num, 8)].label}"
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </section>

        {/* History */}
        <section>
          <h2 className="mb-3 text-sm font-bold">Historial de gestiones</h2>
          <div className="space-y-2.5">
            {gestiones.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
                Sin gestiones registradas todavía.
              </p>
            )}
            {gestiones.map((g) => (
              <div key={g.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    {g.tipo === "visita" ? "🚗 Visita" : "📞 Llamada"}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" /> {formatDate(g.fecha)}
                  </span>
                </div>
                <p className="mt-2.5 text-sm">{g.notas}</p>
                <p className={cn(
                  "mt-2 text-[11px] font-bold uppercase tracking-wider",
                  g.resultado === "exitosa" && "text-success",
                  g.resultado === "sin_respuesta" && "text-destructive",
                  g.resultado === "reagendada" && "text-warning",
                )}>
                  {g.resultado.replace("_", " ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
};

const Row = ({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) => (
  <div className="flex items-start gap-3">
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("text-sm", valueClass)}>{value}</p>
    </div>
  </div>
);

export default ClienteDetalle;
