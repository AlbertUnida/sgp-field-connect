import { Link } from "react-router-dom";
import { Loader2, MapPin, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPYG } from "@/lib/format";

interface CensoCliente {
  id: string;
  nombre_comercial: string;
  ciudad: string | null;
  tarifa_mensual: number | null;
  created_at: string;
}

interface EjecutivoOpt {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string;
}

/**
 * Sección CENSO del panel Admin: clientes sin ejecutivo asignado, con selector
 * para asignarlos a un ejecutivo. Extraída de Admin.tsx — presentacional: el
 * estado y la lógica (cargarCenso, asignarDesdeAdmin) viven en el padre.
 */
export const CensoSection = ({
  clientes, loading, onActualizar, asignaciones, onSelectEjecutivo, ejecutivos, onAsignar, asignando,
}: {
  clientes: CensoCliente[];
  loading: boolean;
  onActualizar: () => void;
  asignaciones: Record<string, string>;
  onSelectEjecutivo: (clienteId: string, ejecutivoId: string) => void;
  ejecutivos: EjecutivoOpt[];
  onAsignar: (clienteId: string) => void;
  asignando: string | null;
}) => (
  <>
    <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4 text-sm text-warning font-semibold">
      ⏳ Clientes sin ejecutivo asignado — requieren asignación para pasar a COMERCIAL
    </div>

    <div className="flex items-center justify-between">
      <p className="text-sm font-bold">{clientes.length} pendientes</p>
      <div className="flex items-center gap-3">
        <button
          onClick={onActualizar}
          disabled={loading}
          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-smooth"
        >
          <svg className={cn("h-3.5 w-3.5", loading && "animate-spin")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
          </svg>
          Actualizar
        </button>
        <Link to="/app/nuevo-cliente" className="text-xs font-semibold text-primary">+ Nuevo cliente</Link>
      </div>
    </div>

    {loading ? (
      <div className="flex justify-center pt-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
    ) : clientes.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm font-semibold text-muted-foreground">Sin clientes pendientes ✅</p>
        <p className="mt-1 text-xs text-muted-foreground">Todos los clientes tienen ejecutivo asignado</p>
      </div>
    ) : (
      <div className="space-y-3">
        {clientes.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm truncate">{c.nombre_comercial}</p>
                {c.ciudad && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" />{c.ciudad}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                {c.tarifa_mensual ? (
                  <p className="text-sm font-bold text-primary">{formatPYG(c.tarifa_mensual)}</p>
                ) : (
                  <p className="text-[11px] text-destructive font-semibold">Sin tarifa</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(c.created_at).toLocaleDateString("es-PY", { day: "2-digit", month: "short" })}
                </p>
              </div>
            </div>

            {!c.tarifa_mensual && (
              <p className="text-[11px] text-destructive">⚠️ Cargá la tarifa antes de asignar</p>
            )}

            <div className="flex gap-2">
              <select
                value={asignaciones[c.id] ?? ""}
                onChange={(e) => onSelectEjecutivo(c.id, e.target.value)}
                disabled={!c.tarifa_mensual}
                className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-40"
              >
                <option value="">Seleccioná ejecutivo...</option>
                {ejecutivos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {[e.nombre, e.apellido].filter(Boolean).join(" ") || e.email}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={() => onAsignar(c.id)}
                disabled={!asignaciones[c.id] || asignando === c.id || !c.tarifa_mensual}
                className="h-10 px-3 shrink-0"
              >
                {asignando === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Asignar"}
              </Button>
              <Link to={`/app/clientes/${c.id}/editar`} className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-secondary px-3 text-sm font-semibold hover:border-primary/40 transition-smooth">
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    )}
  </>
);
