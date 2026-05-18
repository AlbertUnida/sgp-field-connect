import { useState } from "react";
import { X, Download, Loader2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface RangoFecha {
  desde: string; // YYYY-MM-DD
  hasta: string; // YYYY-MM-DD (inclusive)
  label: string;
}

interface Periodo {
  key: string;
  label: string;
  getRango: () => RangoFecha;
}

function isoHoy() {
  return new Date().toISOString().slice(0, 10);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Lunes de la semana actual
function lunesActual() {
  const d = new Date();
  const day = d.getDay() || 7; // domingo = 7
  d.setDate(d.getDate() - (day - 1));
  return d;
}

const PERIODOS: Periodo[] = [
  {
    key: "semana",
    label: "Esta semana",
    getRango: () => {
      const desde = isoDate(lunesActual());
      return { desde, hasta: isoHoy(), label: "Esta semana" };
    },
  },
  {
    key: "quincena",
    label: "Esta quincena",
    getRango: () => {
      const hoy = new Date();
      const dia = hoy.getDate();
      const y = hoy.getFullYear();
      const m = String(hoy.getMonth() + 1).padStart(2, "0");
      const desde = dia <= 15 ? `${y}-${m}-01` : `${y}-${m}-16`;
      return { desde, hasta: isoHoy(), label: "Esta quincena" };
    },
  },
  {
    key: "mes",
    label: "Este mes",
    getRango: () => {
      const hoy = new Date();
      const y = hoy.getFullYear();
      const m = String(hoy.getMonth() + 1).padStart(2, "0");
      return { desde: `${y}-${m}-01`, hasta: isoHoy(), label: `${MESES_FULL[hoy.getMonth()]} ${y}` };
    },
  },
  {
    key: "semestre",
    label: "Este semestre",
    getRango: () => {
      const hoy = new Date();
      const y = hoy.getFullYear();
      const mes = hoy.getMonth(); // 0-based
      const desde = mes < 6 ? `${y}-01-01` : `${y}-07-01`;
      return { desde, hasta: isoHoy(), label: `Semestre ${mes < 6 ? "1" : "2"} ${y}` };
    },
  },
  {
    key: "anio",
    label: "Este año",
    getRango: () => {
      const y = new Date().getFullYear();
      return { desde: `${y}-01-01`, hasta: isoHoy(), label: `Año ${y}` };
    },
  },
  {
    key: "custom",
    label: "Rango personalizado",
    getRango: () => ({ desde: isoHoy(), hasta: isoHoy(), label: "Personalizado" }),
  },
];

const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  /** Recibe el rango seleccionado. Debe retornar Promise para mostrar loading. */
  onExport: (rango: RangoFecha) => Promise<void>;
  titulo?: string;
}

export const ExportModal = ({ open, onClose, onExport, titulo = "Exportar Excel" }: ExportModalProps) => {
  const [periodoKey, setPeriodoKey] = useState("mes");
  const [customDesde, setCustomDesde] = useState(isoHoy());
  const [customHasta, setCustomHasta] = useState(isoHoy());
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  const getRango = (): RangoFecha => {
    if (periodoKey === "custom") {
      return {
        desde: customDesde,
        hasta: customHasta,
        label: `${customDesde} al ${customHasta}`,
      };
    }
    return PERIODOS.find((p) => p.key === periodoKey)!.getRango();
  };

  const handleExport = async () => {
    const rango = getRango();
    if (rango.desde > rango.hasta) return;
    setExporting(true);
    try {
      await onExport(rango);
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet desde abajo */}
      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-card px-5 pt-5 pb-10 shadow-2xl">
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-emerald-600" />
            <h2 className="text-base font-bold">{titulo}</h2>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Selector de período */}
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Período a exportar
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {PERIODOS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodoKey(p.key)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                p.key === "custom" && "col-span-2",
                periodoKey === p.key
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-border bg-background text-foreground hover:border-primary/40"
              )}
            >
              {p.key === "custom" && <Calendar className="mb-0.5 inline h-3.5 w-3.5 mr-1.5 opacity-70" />}
              {p.label}
            </button>
          ))}
        </div>

        {/* Rango personalizado */}
        {periodoKey === "custom" && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Desde</label>
              <input
                type="date"
                value={customDesde}
                max={customHasta}
                onChange={(e) => setCustomDesde(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Hasta</label>
              <input
                type="date"
                value={customHasta}
                min={customDesde}
                max={isoHoy()}
                onChange={(e) => setCustomHasta(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {/* Preview del rango */}
        {periodoKey !== "custom" && (
          <div className="mb-4 rounded-xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
            {(() => {
              const r = getRango();
              return <span>Del <strong>{r.desde}</strong> al <strong>{r.hasta}</strong></span>;
            })()}
          </div>
        )}

        <Button
          onClick={handleExport}
          disabled={exporting || (periodoKey === "custom" && customDesde > customHasta)}
          className="w-full h-12 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
        >
          {exporting
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando archivo...</>
            : <><Download className="h-4 w-4" /> Descargar Excel</>
          }
        </Button>
      </div>
    </>
  );
};
