import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, ChevronRight, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { addBusinessHours } from "@/lib/utils-field";

interface SeguimientoEj {
  id: string;
  nombre: string;
  totalClientes: number;
  visitasVencidas: number;
  contactosVencidos: number;
  proximosVencimientos: number;
}

/**
 * Sección SEGUIMIENTO del panel Admin: métricas por ejecutivo (clientes,
 * visitas/contactos vencidos, próximos vencimientos). Componente autocontenido.
 */
interface EjecutivoRef { id: string; nombre: string | null; apellido: string | null; email: string }

export const SeguimientoSection = ({ ejecutivos }: { ejecutivos: EjecutivoRef[] }) => {
  const [seguimientoData, setSeguimientoData] = useState<SeguimientoEj[]>([]);
  const [loadingSeguimiento, setLoadingSeguimiento] = useState(false);

  const cargarSeguimiento = async () => {
    setLoadingSeguimiento(true);
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    const en7Dias = new Date();
    en7Dias.setDate(en7Dias.getDate() + 7);
    const hoy = new Date();

    // Clientes activos no-CENSO con ejecutivo y rubro
    const { data: clientesData } = await supabase
      .from("clientes")
      .select("id, ejecutivo_id, fecha_vencimiento, rubro_rel:rubro_id(dias_visita)")
      .eq("activo", true)
      .not("instancia", "eq", "CENSO")
      .not("ejecutivo_id", "is", null);

    if (!clientesData || clientesData.length === 0) {
      setSeguimientoData([]);
      setLoadingSeguimiento(false);
      return;
    }

    // A4: JOIN en lugar de .in() — Admin ve todos los clientes, escala sin límite de URL
    const { data: gestiones } = await supabase
      .from("gestiones")
      .select("id, cliente_id, tipo, created_at, clientes!inner(instancia, activo)")
      .eq("clientes.activo", true)
      .not("clientes.instancia", "eq", "CENSO")
      .gte("created_at", hace30Dias.toISOString())
      .order("created_at", { ascending: true });

    const gArr = gestiones ?? [];

    // Calcular por ejecutivo
    const ejMap: Record<string, { visitasV: number; contactosV: number; proxVenc: number; total: number }> = {};

    for (const c of clientesData) {
      const ejId = c.ejecutivo_id as string;
      if (!ejMap[ejId]) ejMap[ejId] = { visitasV: 0, contactosV: 0, proxVenc: 0, total: 0 };
      ejMap[ejId].total++;

      const diasVisita = (c.rubro_rel as any)?.dias_visita ?? 7;

      // Visitas vencidas
      const visitas = gArr
        .filter((g) => g.cliente_id === c.id && g.tipo === "visita")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const diasDesde = visitas.length === 0
        ? 30
        : (hoy.getTime() - new Date(visitas[0].created_at).getTime()) / 86_400_000;
      if (diasDesde > diasVisita) ejMap[ejId].visitasV++;

      // Contactos vencidos (visita sin seguimiento 24h hábiles)
      const visitasRecientes = gArr.filter(
        (g) => g.cliente_id === c.id && g.tipo === "visita" &&
          hoy.getTime() - new Date(g.created_at).getTime() < 10 * 86_400_000
      );
      let tieneContactoVencido = false;
      for (const vis of visitasRecientes) {
        const vFecha = new Date(vis.created_at);
        const deadline = addBusinessHours(vFecha, 24);
        if (hoy > deadline) {
          const tieneContacto = gArr.some(
            (g) => g.cliente_id === c.id && g.tipo !== "visita" &&
              new Date(g.created_at) > vFecha && new Date(g.created_at) <= deadline
          );
          if (!tieneContacto) { tieneContactoVencido = true; break; }
        }
      }
      if (tieneContactoVencido) ejMap[ejId].contactosV++;

      // Próximos vencimientos (licencia vence en 7 días)
      if (c.fecha_vencimiento) {
        // M4: parsear como hora local para evitar bug de UTC (vence a las 21h del día anterior)
        const fv = new Date(c.fecha_vencimiento + "T00:00:00");
        if (fv >= hoy && fv <= en7Dias) ejMap[ejId].proxVenc++;
      }
    }

    // Cruzar con perfiles de ejecutivos
    const resultado: SeguimientoEj[] = ejecutivos
      .filter((e) => ejMap[e.id])
      .map((e) => ({
        id: e.id,
        nombre: [e.nombre, e.apellido].filter(Boolean).join(" ") || e.email,
        totalClientes: ejMap[e.id].total,
        visitasVencidas: ejMap[e.id].visitasV,
        contactosVencidos: ejMap[e.id].contactosV,
        proximosVencimientos: ejMap[e.id].proxVenc,
      }))
      .sort((a, b) => (b.visitasVencidas + b.contactosVencidos) - (a.visitasVencidas + a.contactosVencidos));

    setSeguimientoData(resultado);
    setLoadingSeguimiento(false);
  };

  useEffect(() => { cargarSeguimiento(); }, [ejecutivos]);

  return (
          <>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="text-xs text-muted-foreground">
                Seguimiento en tiempo real de cada ejecutivo — visitas vencidas, contactos sin seguimiento y licencias por vencer en 7 días.
              </p>
            </div>

            {loadingSeguimiento ? (
              <div className="flex justify-center pt-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : seguimientoData.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <p className="text-sm font-semibold text-muted-foreground">Sin datos de ejecutivos</p>
                <p className="mt-1 text-xs text-muted-foreground">Los ejecutivos deben tener clientes activos asignados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {seguimientoData.map((ej) => {
                  const tieneAlertas = ej.visitasVencidas > 0 || ej.contactosVencidos > 0;
                  return (
                    <div key={ej.id} className={cn(
                      "rounded-2xl border bg-card shadow-card overflow-hidden",
                      tieneAlertas ? "border-destructive/30" : "border-border"
                    )}>
                      {/* Header ejecutivo */}
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                          {ej.nombre.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{ej.nombre}</p>
                          <p className="text-[11px] text-muted-foreground">{ej.totalClientes} clientes activos</p>
                        </div>
                        {tieneAlertas && (
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 divide-x divide-border">
                        <Link
                          to={`/app/alertas?tipo=visitas`}
                          className={cn(
                            "flex flex-col items-center py-3 gap-0.5 transition-smooth",
                            ej.visitasVencidas > 0 ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-secondary/60"
                          )}
                        >
                          <Clock className={cn("h-3.5 w-3.5", ej.visitasVencidas > 0 ? "text-destructive" : "text-muted-foreground")} />
                          <span className={cn("text-lg font-bold tabular-nums", ej.visitasVencidas > 0 ? "text-destructive" : "text-foreground")}>
                            {ej.visitasVencidas}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground text-center leading-tight">
                            Visitas{"\n"}vencidas
                          </span>
                        </Link>

                        <Link
                          to={`/app/alertas?tipo=contactos`}
                          className={cn(
                            "flex flex-col items-center py-3 gap-0.5 transition-smooth",
                            ej.contactosVencidos > 0 ? "bg-warning/5 hover:bg-warning/10" : "hover:bg-secondary/60"
                          )}
                        >
                          <AlertTriangle className={cn("h-3.5 w-3.5", ej.contactosVencidos > 0 ? "text-warning" : "text-muted-foreground")} />
                          <span className={cn("text-lg font-bold tabular-nums", ej.contactosVencidos > 0 ? "text-warning" : "text-foreground")}>
                            {ej.contactosVencidos}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground text-center leading-tight">
                            Contactos{"\n"}vencidos
                          </span>
                        </Link>

                        <Link
                          to={`/app/clientes?ej=${ej.id}`}
                          className="flex flex-col items-center py-3 gap-0.5 hover:bg-secondary/60 transition-smooth"
                        >
                          <CalendarClock className={cn("h-3.5 w-3.5", ej.proximosVencimientos > 0 ? "text-primary" : "text-muted-foreground")} />
                          <span className={cn("text-lg font-bold tabular-nums", ej.proximosVencimientos > 0 ? "text-primary" : "text-foreground")}>
                            {ej.proximosVencimientos}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground text-center leading-tight">
                            Vencen{"\n"}en 7 días
                          </span>
                        </Link>
                      </div>

                      {/* Ver cartera */}
                      <Link
                        to={`/app/clientes?ej=${ej.id}`}
                        className="flex items-center justify-between px-4 py-2.5 border-t border-border text-xs font-semibold text-primary hover:bg-secondary/40 transition-smooth"
                      >
                        <span>Ver cartera completa</span>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </>
  );
};
