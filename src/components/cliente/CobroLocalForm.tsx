import { Calendar, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPYG } from "@/lib/format";

export interface CobroLocalState {
  monto: string;
  metodo_pago: string;
  modalidad: string;
  fecha_cobro: string;
  periodo_desde: string;
  periodo_hasta: string;
  referencia: string;
  notas: string;
}

/**
 * Formulario de cobro de un local permanente (extraído de ClienteDetalle, Fase 1).
 * Presentacional: el estado y la lógica de guardado viven en el padre.
 */
export const CobroLocalForm = ({ cobro, setCob, tarifaMensual, guardando, onConfirmar }: {
  cobro: CobroLocalState;
  setCob: (campo: string, valor: string) => void;
  tarifaMensual: number | null;
  guardando: boolean;
  onConfirmar: () => void;
}) => (
  <div className="mt-3 rounded-2xl border border-success/30 bg-success/5 p-4 space-y-4">
    <p className="text-xs font-bold uppercase tracking-wider text-success">Datos del cobro</p>

    {/* Monto */}
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Monto cobrado (Gs.) <span className="text-destructive">*</span>
      </Label>
      <Input
        type="number"
        placeholder={tarifaMensual ? String(tarifaMensual) : "500000"}
        value={cobro.monto}
        onChange={(e) => setCob("monto", e.target.value)}
        className="h-11"
      />
      {tarifaMensual && !cobro.monto && (
        <button
          type="button"
          onClick={() => setCob("monto", String(tarifaMensual))}
          className="text-[11px] text-primary font-semibold hover:underline"
        >
          Usar tarifa mensual: {formatPYG(tarifaMensual)}
        </button>
      )}
    </div>

    {/* Método de pago + Modalidad */}
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Método</Label>
        <select
          value={cobro.metodo_pago}
          onChange={(e) => setCob("metodo_pago", e.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="cheque">Cheque</option>
          <option value="debito">Débito</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Modalidad</Label>
        <select
          value={cobro.modalidad}
          onChange={(e) => setCob("modalidad", e.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="mensual">Mensual</option>
          <option value="trimestral">Trimestral</option>
          <option value="semestral">Semestral</option>
          <option value="anual">Anual</option>
        </select>
      </div>
    </div>

    {/* Fecha del cobro */}
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Fecha del cobro <span className="text-destructive">*</span>
      </Label>
      <div className="relative">
        <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="date"
          value={cobro.fecha_cobro}
          onChange={(e) => setCob("fecha_cobro", e.target.value)}
          className="h-11 pl-10"
        />
      </div>
    </div>

    {/* Período */}
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Período desde</Label>
        <Input type="date" value={cobro.periodo_desde}
          onChange={(e) => setCob("periodo_desde", e.target.value)} className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Período hasta</Label>
        <Input type="date" value={cobro.periodo_hasta}
          onChange={(e) => setCob("periodo_hasta", e.target.value)} className="h-11" />
      </div>
    </div>

    {/* Referencia */}
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Referencia / Comprobante</Label>
      <Input
        placeholder="Nro. de comprobante, transferencia, etc."
        value={cobro.referencia}
        onChange={(e) => setCob("referencia", e.target.value)}
        className="h-11"
      />
    </div>

    {/* Notas */}
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notas</Label>
      <Textarea
        placeholder="Observaciones del cobro..."
        value={cobro.notas}
        onChange={(e) => setCob("notas", e.target.value)}
        rows={2}
        className="resize-none"
      />
    </div>

    <div className="rounded-xl bg-success/10 px-3 py-2.5 text-xs text-success font-semibold">
      ✅ Al guardar, el cliente pasará automáticamente a <strong>COBRANZAS</strong> y el monto se sumará a tu meta del mes.
    </div>

    <Button
      onClick={onConfirmar}
      disabled={guardando || !cobro.monto || !cobro.fecha_cobro}
      className="w-full h-11 gap-2 font-semibold bg-green-600 hover:bg-green-700 text-white border-0"
    >
      {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
      {guardando ? "Registrando..." : "Confirmar cobro"}
    </Button>
  </div>
);
