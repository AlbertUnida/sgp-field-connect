import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Phone, MapPin, ChevronRight, Loader2, Clock } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";

interface ClienteAlerta {
  id: string;
  nombre_comercial: string;
  ciudad: string | null;
  telefono: string | null;
  ejecutivo_nombre: string | null;
  dias_desde: number;
  limite_dias: number;
}

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

const Alertas = () => {
  const [params] = useSearchParams();
  const tipo = params.get("tipo") ?? "visitas"; // "visitas" | "contactos"
  const { user } = useAuth();
  const { canManage } = useProfile();

  const [clientes, setClientes] = useState<ClienteAlerta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    cargarAlertas();
  }, [user, tipo]);

  const cargarAlertas = async () => {
    setLoading(true);

    // Clientes activos (no CENSO) con rubro y ejecutivo
    let qClientes = supabase
      .from("clientes")
      .select("id, nombre_comercial, ciudad, telefono, ejecutivo_id, rubro_rel:rubro_id(dias_visita), ejecutivo:ejecutivo_id(nombre, apellido)")
      .eq("activo", true)
      .not("instancia", "eq", "CENSO");

    if (!canManage) qClientes = qClientes.eq("ejecutivo_id", user!.id);

    const { data: clientesData } = await qClientes;
    if (!clientesData || clientesData.length === 0) { setClientes([]); setLoading(false); return; }

    const ids = clientesData.map((c) => c.id);
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const { data: gestiones } = await supabase
      .from("gestiones")
      .select("id, cliente_id, tipo, created_at")
      .in("cliente_id", ids)
      .gte("created_at", hace30Dias.toISOString())
      .order("created_at", { ascending: true });

    const gestionesArr = gestiones ?? [];
    const hoy = new Date();
    const resultado: ClienteAlerta[] = [];

    for (const c of clientesData) {
      const diasVisita = (c.rubro_rel as any)?.dias_visita ?? 7;
      const ejecutivoNombre = c.ejecutivo
        ? `${(c.ejecutivo as any).nombre ?? ""} ${(c.ejecutivo as any).apellido ?? ""}`.trim()
        : null;

      if (tipo === "visitas") {
        // Última visita del cliente
        const visitas = gestionesArr
          .filter((g) => g.cliente_id === c.id && g.tipo === "visita")
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        let diasDesde: number;
        if (visitas.length === 0) {
          // Nunca visitado — contar desde hace 30 días (umbral máximo)
          diasDesde = 30;
        } else {
          diasDesde = (hoy.getTime() - new Date(visitas[0].created_at).getTime()) / 86_400_000;
        }

        if (diasDesde > diasVisita) {
          resultado.push({
            id: c.id,
            nombre_comercial: c.nombre_comercial,
            ciudad: c.ciudad,
            telefono: c.telefono,
            ejecutivo_nombre: ejecutivoNombre,
            dias_desde: Math.floor(diasDesde),
            limite_dias: diasVisita,
          });
        }
      } else {
        // Contactos vencidos: visita sin seguimiento en 24h hábiles
        const visitasRecientes = gestionesArr.filter(
          (g) => g.cliente_id === c.id && g.tipo === "visita" &&
          hoy.getTime() - new Date(g.created_at).getTime() < 10 * 86_400_000
        );

        for (const visita of visitasRecientes) {
          const visitaFecha = new Date(visita.created_at);
          const deadline = addBusinessHours(visitaFecha, 24);

          if (hoy > deadline) {
            const tieneContacto = gestionesArr.some(
              (g) =>
                g.cliente_id === c.id &&
                g.tipo !== "visita" &&
                new Date(g.created_at) > visitaFecha &&
                new Date(g.created_at) <= deadline
            );

            if (!tieneContacto) {
              const horasVencido = Math.floor((hoy.getTime() - deadline.getTime()) / 3_600_000);
              resultado.push({
                id: c.id,
                nombre_comercial: c.nombre_comercial,
                ciudad: c.ciudad,
                telefono: c.telefono,
                ejecutivo_nombre: ejecutivoNombre,
                dias_desde: horasVencido,
                limite_dias: 24,
              });
              break; // Una vez por cliente
            }
          }
        }
      }
    }

    // Ordenar por mayor retraso primero
    resultado.sort((a, b) => b.dias_desde - a.dias_desde);
    setClientes(resultado);
    setLoading(false);
  };

  const esVisitas = tipo === "visitas";
  const titulo = esVisitas ? "Visitas Vencidas" : "Contactos Vencidos";
  const subtitulo = esVisitas
    ? "Clientes que superaron el plazo de visita del rubro"
    : "Visitas sin contacto de seguimiento en 24 hs hábiles";

  return (
    <>
      <header className="gradient-hero text-primary-foreground px-4 pb-5 pt-4">
        <div className="flex items-center justify-between">
          <Link to="/app" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className={cn(
            "rounded-full px-3 py-1 text-[11px] font-bold uppercase",
            esVisitas ? "bg-destructive/30 text-white" : "bg-warning/30 text-white"
          )}>
            {clientes.length} {loading ? "..." : "alertas"}
          </span>
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn("h-5 w-5", esVisitas ? "text-destructive" : "text-warning")} />
            <h1 className="text-xl font-bold">{titulo}</h1>
          </div>
          <p className="mt-1 text-xs text-primary-foreground/70">{subtitulo}</p>
        </div>
      </header>

      <div className="px-4 pt-4 pb-8 space-y-2.5">
        {loading ? (
          <div className="flex justify-center pt-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : clientes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-2xl">✅</p>
            <p className="mt-2 text-sm font-semibold">Sin alertas pendientes</p>
            <p className="mt-1 text-xs text-muted-foreground">Todos los plazos están al día</p>
          </div>
        ) : (
          clientes.map((c) => (
            <Link
              key={c.id}
              to={`/app/clientes/${c.id}`}
              className="block rounded-2xl border border-border bg-card p-4 shadow-card transition-smooth hover:border-primary/40 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{c.nombre_comercial}</p>
                  {c.ejecutivo_nombre && (
                    <p className="text-[11px] text-primary font-semibold mt-0.5">{c.ejecutivo_nombre}</p>
                  )}
                  {c.ciudad && (
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                      <MapPin className="h-3 w-3" />{c.ciudad}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-bold",
                    esVisitas ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                  )}>
                    {esVisitas
                      ? `${c.dias_desde}d / ${c.limite_dias}d`
                      : `${c.dias_desde}h vencido`
                    }
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {c.telefono && (
                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Phone className="h-3 w-3" />{c.telefono}
                </div>
              )}

              <div className={cn(
                "mt-2.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold",
                esVisitas ? "bg-destructive/8 text-destructive" : "bg-warning/10 text-warning"
              )}>
                <Clock className="h-3 w-3" />
                {esVisitas
                  ? `Última visita hace ${c.dias_desde} días — límite del rubro: ${c.limite_dias} días`
                  : `Sin contacto de seguimiento — vencido hace ${c.dias_desde} horas`
                }
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
};

export default Alertas;
