import type { ComponentType } from "react";
import { Target, AlertCircle, Calendar, Loader2, CheckCircle2 } from "lucide-react";
import { RESULTADOS_GESTION } from "@/lib/resultados-gestion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { TipoResultado } from "./types";

interface TipoGestion { key: string; label: string; icon: ComponentType<{ className?: string }>; color: string }

/**
 * Formulario de registro de gestión inline (visita / llamada / whatsapp / email)
 * de la bitácora de ClienteDetalle. Extraído en Fase 1 — presentacional: todo el
 * estado y la lógica de guardado (registrarActividad) viven en el padre.
 * Los valores derivados (mostrarTarea, mostrarResultado, resultadoRealObj) se
 * calculan acá a partir de `form` / `resultadoId` / `resultadoReal`.
 */
export const GestionForm = (props: {
  tiposGestion: TipoGestion[];
  form: { tipo: string; notas: string; proxima_accion: string };
  onCambiarTipo: (key: string) => void;
  setFormCampo: (campo: "notas" | "proxima_accion", valor: string) => void;
  resultadoId: string;
  onResultadoChange: (id: string) => void;
  cargandoResultados: boolean;
  tiposResultadoFiltrados: TipoResultado[];
  tipoFormulario: string | null;
  tituloReceptor: string | null;
  resultadoReal: string;
  setResultadoReal: (v: string) => void;
  receptorNombre: string; setReceptorNombre: (v: string) => void;
  receptorApellido: string; setReceptorApellido: (v: string) => void;
  fechaEntrega: string; setFechaEntrega: (v: string) => void;
  actaNro: string; setActaNro: (v: string) => void;
  contactoNombre: string; setContactoNombre: (v: string) => void;
  contactoApellido: string; setContactoApellido: (v: string) => void;
  contactoTelefono: string; setContactoTelefono: (v: string) => void;
  contactoEmail: string; setContactoEmail: (v: string) => void;
  contactoFecha: string; setContactoFecha: (v: string) => void;
  guardando: boolean;
  onGuardar: () => void;
}) => {
  const {
    tiposGestion, form, onCambiarTipo, setFormCampo, resultadoId, onResultadoChange,
    cargandoResultados, tiposResultadoFiltrados, tipoFormulario, tituloReceptor,
    resultadoReal, setResultadoReal,
    receptorNombre, setReceptorNombre, receptorApellido, setReceptorApellido,
    fechaEntrega, setFechaEntrega, actaNro, setActaNro,
    contactoNombre, setContactoNombre, contactoApellido, setContactoApellido,
    contactoTelefono, setContactoTelefono, contactoEmail, setContactoEmail,
    contactoFecha, setContactoFecha, guardando, onGuardar,
  } = props;

  const resultadoRealObj = RESULTADOS_GESTION.find((r) => r.key === resultadoReal) ?? null;
  const mostrarTarea = form.tipo === "visita";
  const mostrarResultado = form.tipo !== "email" && (form.tipo !== "visita" || !!resultadoId);

  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
      {/* Tipo */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo de gestión</Label>
        <div className="grid grid-cols-3 gap-2">
          {tiposGestion.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onCambiarTipo(t.key)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border py-3 text-[11px] font-bold uppercase transition-smooth",
                form.tipo === t.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-muted-foreground"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tarea — solo para VISITA */}
      {mostrarTarea && (
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tarea <span className="text-destructive">*</span></Label>
        <select
          value={resultadoId}
          onChange={(e) => onResultadoChange(e.target.value)}
          disabled={cargandoResultados}
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="">Seleccioná la tarea realizada...</option>
          {tiposResultadoFiltrados.map((r) => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>
      </div>
      )}

      {/* Bloque especial: Nota / Visita Seguimiento / Reunión (con receptor) */}
      {mostrarTarea && (tipoFormulario === "nota_comercial" || tipoFormulario === "nota_reclamo" ||
        tipoFormulario === "visita_seguimiento" || tipoFormulario === "reunion") && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <p className="text-xs font-bold text-primary uppercase tracking-wider">
            📄 {tituloReceptor ?? "Datos del receptor"}
          </p>
          <p className="text-[11px] text-muted-foreground">Datos de quien recibió / estuvo presente.</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nombre <span className="text-destructive">*</span></Label>
              <Input placeholder="Nombre" value={receptorNombre} onChange={(e) => setReceptorNombre(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Apellido</Label>
              <Input placeholder="Apellido" value={receptorApellido} onChange={(e) => setReceptorApellido(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fecha</Label>
              <Input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Acta Nro.</Label>
              <Input placeholder="Nº de acta" value={actaNro} onChange={(e) => setActaNro(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Bloque contacto: LLAMADA / WHATSAPP */}
      {(form.tipo === "llamada" || form.tipo === "whatsapp") && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            {form.tipo === "llamada" ? "📞 Datos de la llamada" : "💬 Datos del WhatsApp"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Nombre <span className="text-destructive">*</span></Label>
              <Input placeholder="Nombre" value={contactoNombre} onChange={(e) => setContactoNombre(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Apellido</Label>
              <Input placeholder="Apellido" value={contactoApellido} onChange={(e) => setContactoApellido(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Nro. Teléfono</Label>
              <Input placeholder="09X XXX XXX" value={contactoTelefono} onChange={(e) => setContactoTelefono(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Fecha</Label>
              <Input type="date" value={contactoFecha} onChange={(e) => setContactoFecha(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </div>
      )}

      {/* Bloque contacto: EMAIL */}
      {form.tipo === "email" && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">✉️ Datos del destinatario</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Nombre</Label>
              <Input placeholder="Nombre" value={contactoNombre} onChange={(e) => setContactoNombre(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Apellido</Label>
              <Input placeholder="Apellido" value={contactoApellido} onChange={(e) => setContactoApellido(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Email</Label>
              <Input type="email" placeholder="correo@ejemplo.com" value={contactoEmail} onChange={(e) => setContactoEmail(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Fecha</Label>
              <Input type="date" value={contactoFecha} onChange={(e) => setContactoFecha(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground italic">El resultado se registrará cuando llegue la respuesta.</p>
        </div>
      )}

      {/* Bloque RESULTADO — visita (tras tarea) / llamada / whatsapp */}
      {mostrarResultado && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Resultado <span className="text-destructive">*</span>
            </p>
          </div>
          <select
            value={resultadoReal}
            onChange={(e) => setResultadoReal(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">¿Cuál fue el resultado?</option>
            {RESULTADOS_GESTION.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
          {resultadoRealObj?.autoAgenda && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                Se agendará revisita automáticamente en 30 días.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Notas / Resumen */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notas / Resumen</Label>
        <Textarea
          placeholder="Puntos clave conversados, acuerdos, observaciones..."
          value={form.notas}
          onChange={(e) => setFormCampo("notas", e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Próxima acción — oculta si el resultado auto-agenda */}
      {!resultadoRealObj?.autoAgenda && (
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Próxima acción</Label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={form.proxima_accion}
              onChange={(e) => setFormCampo("proxima_accion", e.target.value)}
              className="h-11 pl-10"
            />
          </div>
        </div>
      )}

      <Button onClick={onGuardar} disabled={guardando} className="w-full h-11 gap-2 font-semibold">
        {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {guardando ? "Guardando..." : "Guardar en bitácora"}
      </Button>
    </div>
  );
};
