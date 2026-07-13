import { X, Plus, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface EventoFormState {
  rubro_evento_id: string;
  nombre_evento: string;
  fecha_evento: string;
  tipo_evento: string;
  tarifa_evento: string;
  nombre_salon: string;
  notas: string;
}

interface Opcion { id: string; nombre: string }

/**
 * Formulario inline de "Nuevo evento" (extraído de ClienteDetalle, Fase 1).
 * Presentacional: el estado (`formEvento`) y el guardado viven en el padre.
 */
export const EventoForm = ({ form, setEv, rubros, tipos, guardando, onGuardar, onClose }: {
  form: EventoFormState;
  setEv: (campo: string, valor: string) => void;
  rubros: Opcion[];
  tipos: Opcion[];
  guardando: boolean;
  onGuardar: (abrirOtro: boolean) => void;
  onClose: () => void;
}) => (
  <div className="rounded-2xl border-2 border-amber-400 bg-amber-50/60 dark:bg-amber-950/30 p-4 space-y-4">
    <div className="flex items-center justify-between">
      <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Nuevo evento</p>
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>

    {/* Rubro — PRIMERO */}
    <div className="space-y-1.5">
      <Label className="text-xs">Rubro <span className="text-destructive">*</span></Label>
      <select
        value={form.rubro_evento_id}
        onChange={(e) => setEv("rubro_evento_id", e.target.value)}
        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
      >
        <option value="">Seleccioná un rubro...</option>
        {rubros.map((r) => (
          <option key={r.id} value={r.id}>{r.nombre}</option>
        ))}
      </select>
    </div>

    {/* Nombre */}
    <div className="space-y-1.5">
      <Label className="text-xs">Nombre del evento <span className="text-destructive">*</span></Label>
      <Input
        placeholder="Casamiento García – López"
        value={form.nombre_evento}
        onChange={(e) => setEv("nombre_evento", e.target.value)}
        className="h-11"
      />
    </div>

    {/* Fecha y Tipo en fila */}
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Fecha <span className="text-destructive">*</span></Label>
        <Input
          type="date"
          value={form.fecha_evento}
          onChange={(e) => setEv("fecha_evento", e.target.value)}
          className="h-11"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Tipo <span className="text-destructive">*</span></Label>
        <select
          value={form.tipo_evento}
          onChange={(e) => setEv("tipo_evento", e.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="">Tipo...</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.nombre}>{t.nombre}</option>
          ))}
        </select>
      </div>
    </div>

    {/* Tarifa */}
    <div className="space-y-1.5">
      <Label className="text-xs">Tarifa del evento (Gs.)</Label>
      <Input
        type="number"
        placeholder="500000"
        value={form.tarifa_evento}
        onChange={(e) => setEv("tarifa_evento", e.target.value)}
        className="h-11"
      />
    </div>

    {/* Lugar del evento */}
    <div className="space-y-1.5">
      <Label className="text-xs">Lugar del evento</Label>
      <Input
        placeholder="Ej: Salón Los Pinos, Av. España 1234"
        value={form.nombre_salon}
        onChange={(e) => setEv("nombre_salon", e.target.value)}
        className="h-11"
      />
    </div>

    {/* Notas */}
    <div className="space-y-1.5">
      <Label className="text-xs">Notas</Label>
      <Textarea
        placeholder="Observaciones..."
        value={form.notas}
        onChange={(e) => setEv("notas", e.target.value)}
        rows={2}
        className="resize-none text-sm"
      />
    </div>

    {/* Botones de acción */}
    <div className="flex gap-2">
      <Button
        onClick={() => onGuardar(true)}
        disabled={guardando}
        variant="outline"
        className="flex-1 gap-1.5 border-amber-400 text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-xs h-10"
      >
        {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Guardar y agregar otro
      </Button>
      <Button
        onClick={() => onGuardar(false)}
        disabled={guardando}
        className="flex-1 gap-1.5 text-xs h-10"
      >
        {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        Guardar y cerrar
      </Button>
    </div>
  </div>
);
