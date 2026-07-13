import { X, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPYG } from "@/lib/format";
import type { EventoAgenda } from "./types";

export interface CobroEventosState {
  monto: string;
  metodo_pago: string;
  modalidad: string;
  fecha_cobro: string;
  razon_social_factura: string;
  ruc_factura: string;
  lugar_evento: string;
  direccion_evento: string;
  email_contacto: string;
  telefono_contacto: string;
  referencia: string;
  notas: string;
}

/**
 * Formulario de cobro por lote de eventos (extraído de ClienteDetalle, Fase 1).
 * Presentacional: el estado (`cobroEv`) y la lógica de guardado viven en el padre.
 * `eventos` = lista ya filtrada de eventos seleccionados.
 */
export const CobroEventosForm = ({ cobroEv, setCobEv, eventos, guardando, onConfirmar, onClose }: {
  cobroEv: CobroEventosState;
  setCobEv: (campo: string, valor: string) => void;
  eventos: EventoAgenda[];
  guardando: boolean;
  onConfirmar: () => void;
  onClose: () => void;
}) => (
  <div className="rounded-2xl border-2 border-green-500 bg-green-50/60 dark:bg-green-950/30 p-4 space-y-4">
    <div className="flex items-center justify-between">
      <p className="text-xs font-bold uppercase tracking-wider text-green-700 dark:text-green-400">Registrar cobro de eventos</p>
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>

    {/* Resumen de eventos seleccionados */}
    <div className="rounded-xl bg-white/60 dark:bg-black/20 border border-green-200 dark:border-green-800 p-3 space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Eventos incluidos</p>
      {eventos.map((ev) => (
        <div key={ev.id} className="flex items-center justify-between text-xs">
          <span className="font-semibold">EV-{String(ev.numero_evento).padStart(3, "0")} · {ev.nombre_evento ?? "Sin nombre"}</span>
          <span className="text-muted-foreground shrink-0 ml-2">{ev.tarifa_evento ? formatPYG(ev.tarifa_evento) : "—"}</span>
        </div>
      ))}
    </div>

    {/* Lugar del evento */}
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Lugar del evento</p>
      <p className="text-[11px] text-muted-foreground">Pre-cargado del cliente. Editá si el evento es en otro lugar.</p>
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lugar del evento</Label>
        <Input
          placeholder="Ej: Salón Los Pinos"
          value={cobroEv.lugar_evento}
          onChange={(e) => setCobEv("lugar_evento", e.target.value)}
          className="h-10 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dirección</Label>
        <Input
          placeholder="Av. España 1234"
          value={cobroEv.direccion_evento}
          onChange={(e) => setCobEv("direccion_evento", e.target.value)}
          className="h-10 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Correo electrónico</Label>
        <Input
          type="email"
          placeholder="contacto@ejemplo.com"
          value={cobroEv.email_contacto}
          onChange={(e) => setCobEv("email_contacto", e.target.value)}
          className="h-10 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Teléfono contacto</Label>
        <Input
          type="tel"
          placeholder="+595 981 123-456"
          value={cobroEv.telefono_contacto}
          onChange={(e) => setCobEv("telefono_contacto", e.target.value)}
          className="h-10 text-sm"
        />
      </div>
    </div>

    {/* Datos de facturación */}
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Datos de facturación</p>
      <p className="text-[11px] text-muted-foreground">Verificá y editá si el pagador es distinto al titular del contrato.</p>
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Razón Social</Label>
        <Input
          placeholder="Razón social del pagador"
          value={cobroEv.razon_social_factura}
          onChange={(e) => setCobEv("razon_social_factura", e.target.value)}
          className="h-10 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">RUC</Label>
        <Input
          placeholder="RUC del pagador"
          value={cobroEv.ruc_factura}
          onChange={(e) => setCobEv("ruc_factura", e.target.value)}
          className="h-10 text-sm"
        />
      </div>
    </div>

    {/* Monto */}
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Monto cobrado (Gs.) <span className="text-destructive">*</span>
      </Label>
      <Input
        type="number"
        placeholder="Total"
        value={cobroEv.monto}
        onChange={(e) => setCobEv("monto", e.target.value)}
        className="h-11"
      />
    </div>

    {/* Modalidad — eventos son siempre pago único */}
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Modalidad</Label>
      <div className="h-11 flex items-center px-3 rounded-xl border border-input bg-muted/40 text-sm text-muted-foreground">
        Pago único por evento
      </div>
    </div>

    {/* Método + Fecha */}
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Método</Label>
        <select
          value={cobroEv.metodo_pago}
          onChange={(e) => setCobEv("metodo_pago", e.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="cheque">Cheque</option>
          <option value="debito">Débito</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fecha <span className="text-destructive">*</span></Label>
        <Input
          type="date"
          value={cobroEv.fecha_cobro}
          onChange={(e) => setCobEv("fecha_cobro", e.target.value)}
          className="h-11"
        />
      </div>
    </div>

    {/* Nro. Comprobante — solo para transferencia, cheque, débito */}
    {["transferencia", "cheque", "debito"].includes(cobroEv.metodo_pago) && (
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Nro. de Comprobante <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="Nro. de transferencia, cheque, etc."
          value={cobroEv.referencia}
          onChange={(e) => setCobEv("referencia", e.target.value)}
          className="h-11"
        />
      </div>
    )}

    {/* Notas */}
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notas</Label>
      <Textarea
        placeholder="Observaciones del cobro..."
        value={cobroEv.notas}
        onChange={(e) => setCobEv("notas", e.target.value)}
        rows={2}
        className="resize-none text-sm"
      />
    </div>

    <div className="rounded-xl bg-green-100 dark:bg-green-900/30 px-3 py-2.5 text-xs text-green-800 dark:text-green-300 font-semibold">
      ✅ Al confirmar, los eventos seleccionados quedarán marcados como <strong>cerrado</strong>. El cliente permanece en COMERCIAL.
    </div>

    <Button
      onClick={onConfirmar}
      disabled={guardando || !cobroEv.monto || !cobroEv.fecha_cobro}
      className="w-full h-11 gap-2 font-semibold bg-green-600 hover:bg-green-700 text-white border-0"
    >
      {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
      {guardando ? "Registrando..." : `Confirmar cobro de ${eventos.length} evento(s)`}
    </Button>
  </div>
);
