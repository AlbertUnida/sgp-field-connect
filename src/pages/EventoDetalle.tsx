import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Car, PhoneCall, Mail, MessageCircle, Calendar,
  Building2, FileText, Loader2, CheckCircle2, Clock,
  ChevronDown, ChevronUp, Save, Pencil, User
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { formatPYG, relativeDate } from "@/lib/mock-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Evento {
  id: string;
  numero_evento: number;
  cliente_id: number;
  nombre_evento: string | null;
  fecha_evento: string | null;
  tipo_evento: string | null;
  tarifa_evento: number | null;
  estado: string;
  notas: string | null;
  ejecutivo_id: string | null;
  ejecutivo: { nombre: string; apellido: string } | null;
  cliente: { nombre_comercial: string } | null;
}

interface TipoResultado {
  id: string;
  nombre: string;
  tipo_formulario: string | null;
  tipo_cartera: string;
  activo: boolean;
  orden: number;
}

interface Gestion {
  id: number;
  tipo: string;
  resultado: string | null;
  nota: string | null;
  fecha_inicio: string | null;
  created_at: string;
  ejecutivo: { nombre: string; apellido: string } | null;
}

const TIPOS_GESTION = [
  { key: "visita",    label: "Visita",    icon: Car,           color: "bg-blue-100 text-blue-700" },
  { key: "llamada",   label: "Llamada",   icon: PhoneCall,     color: "bg-green-100 text-green-700" },
  { key: "email",     label: "Email",     icon: Mail,          color: "bg-purple-100 text-purple-700" },
  { key: "whatsapp",  label: "WhatsApp",  icon: MessageCircle, color: "bg-emerald-100 text-emerald-700" },
];

const ESTADOS_EVENTO = [
  { key: "prospecto",  label: "Prospecto",  color: "bg-yellow-100 text-yellow-700" },
  { key: "confirmado", label: "Confirmado", color: "bg-blue-100 text-blue-700" },
  { key: "cerrado",    label: "Cerrado",    color: "bg-green-100 text-green-700" },
  { key: "cancelado",  label: "Cancelado",  color: "bg-red-100 text-red-700" },
];

const TIPOS_EVENTO_LABEL: Record<string, string> = {
  casamiento: "Casamiento", quinceanos: "Quinceaños", corporativo: "Corporativo",
  social: "Social / Privado", musical: "Musical / Show", otro: "Otro",
};

const EventoDetalle = () => {
  const { id: clienteId, eventoId } = useParams();
  const { user } = useAuth();
  const { canManage } = useProfile();
  const navigate = useNavigate();

  const [evento, setEvento] = useState<Evento | null>(null);
  const [gestiones, setGestiones] = useState<Gestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [tiposResultado, setTiposResultado] = useState<TipoResultado[]>([]);
  const [resultadosCompletados, setResultadosCompletados] = useState<Set<string>>(new Set());
  const [resultadoId, setResultadoId] = useState("");
  const [formTipo, setFormTipo] = useState("visita");
  const [notas, setNotas] = useState("");
  const [proxima, setProxima] = useState("");

  // Editar estado del evento
  const [editandoEstado, setEditandoEstado] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState("");
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  const resultadoSeleccionado = tiposResultado.find((t) => t.id === resultadoId) ?? null;

  // Filtrar tipos_resultado por cartera evento + filtro secuencial nota_reclamo
  const tiposResultadoFiltrados = (() => {
    const porCartera = tiposResultado.filter(
      (t) => t.tipo_cartera === "ambos" || t.tipo_cartera === "evento"
    );
    const notaReclamo = porCartera
      .filter((t) => t.tipo_formulario === "nota_reclamo")
      .sort((a, b) => a.orden - b.orden);
    const proxPendiente = notaReclamo.find((t) => !resultadosCompletados.has(t.id));
    return [
      ...porCartera.filter((t) => t.tipo_formulario !== "nota_reclamo"),
      ...(proxPendiente ? [proxPendiente] : []),
    ];
  })();

  useEffect(() => {
    if (!eventoId) return;
    cargarEvento();
    cargarGestiones();
    cargarResultados();
  }, [eventoId]);

  const cargarEvento = async () => {
    const { data, error } = await supabase
      .from("eventos_agenda")
      .select("*, ejecutivo:ejecutivo_id(nombre, apellido), cliente:cliente_id(nombre_comercial)")
      .eq("id", eventoId)
      .single();
    if (error || !data) { toast.error("Evento no encontrado"); navigate(-1); return; }
    setEvento(data);
    setNuevoEstado(data.estado);
    setLoading(false);
  };

  const cargarGestiones = async () => {
    const { data } = await supabase
      .from("gestiones")
      .select("id, tipo, resultado, nota, fecha_inicio, created_at, ejecutivo:ejecutivo_id(nombre, apellido)")
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: false });
    setGestiones(data ?? []);
    const ids = new Set<string>((data ?? []).map((g: any) => g.resultado_id).filter(Boolean));
    setResultadosCompletados(ids);
  };

  const cargarResultados = async () => {
    const { data } = await supabase
      .from("tipos_resultado")
      .select("id, nombre, tipo_formulario, tipo_cartera, activo, orden")
      .eq("activo", true)
      .order("orden")
      .order("nombre");
    setTiposResultado(data ?? []);
  };

  const registrarGestion = async () => {
    if (!resultadoId) { toast.error("Seleccioná el resultado de la gestión"); return; }
    if (!evento) return;

    setGuardando(true);
    const { error } = await supabase.from("gestiones").insert({
      cliente_id: evento.cliente_id,
      evento_id: eventoId,
      tipo: formTipo,
      resultado_id: resultadoId,
      resultado: resultadoSeleccionado?.nombre ?? "",
      nota: notas.trim() || null,
      proxima_accion: proxima || null,
      ejecutivo_id: user!.id,
      fecha_inicio: new Date().toISOString(),
    });

    if (error) { toast.error("Error al registrar: " + error.message); setGuardando(false); return; }

    toast.success("✅ Gestión registrada");
    setResultadoId(""); setNotas(""); setProxima(""); setShowForm(false);
    cargarGestiones();
    setGuardando(false);
  };

  const guardarEstado = async () => {
    if (!nuevoEstado || !evento) return;
    setGuardandoEstado(true);
    const { error } = await supabase
      .from("eventos_agenda")
      .update({ estado: nuevoEstado })
      .eq("id", eventoId);
    if (error) { toast.error("Error al actualizar estado"); setGuardandoEstado(false); return; }
    setEvento((p) => p ? { ...p, estado: nuevoEstado } : p);
    setEditandoEstado(false);
    setGuardandoEstado(false);
    toast.success("Estado actualizado ✅");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!evento) return null;

  const estadoInfo = ESTADOS_EVENTO.find((e) => e.key === evento.estado) ?? ESTADOS_EVENTO[0];

  return (
    <>
      <AppHeader
        title={evento.nombre_evento ?? "Evento"}
        subtitle={evento.cliente?.nombre_comercial ?? ""}
      />

      <div className="space-y-4 px-4 pt-4 pb-8">

        {/* Volver al cliente */}
        <Link
          to={`/app/clientes/${clienteId}`}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a {evento.cliente?.nombre_comercial}
        </Link>

        {/* Datos del evento */}
        <section className="rounded-2xl border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-4 shadow-card space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Evento #{String(evento.numero_evento).padStart(3, "0")}
            </h2>
            {!editandoEstado && (
              <button
                onClick={() => setEditandoEstado(true)}
                className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold flex items-center gap-1", estadoInfo.color)}
              >
                <Pencil className="h-2.5 w-2.5" />
                {estadoInfo.label}
              </button>
            )}
          </div>

          {editandoEstado && (
            <div className="flex gap-2 flex-wrap">
              {ESTADOS_EVENTO.map((e) => (
                <button
                  key={e.key}
                  onClick={() => setNuevoEstado(e.key)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[11px] font-bold border transition-smooth",
                    nuevoEstado === e.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {e.label}
                </button>
              ))}
              <Button size="sm" onClick={guardarEstado} disabled={guardandoEstado} className="h-7 text-[11px]">
                {guardandoEstado ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditandoEstado(false); setNuevoEstado(evento.estado); }} className="h-7 text-[11px]">
                Cancelar
              </Button>
            </div>
          )}

          {evento.fecha_evento && (
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Fecha" value={
              new Date(evento.fecha_evento + "T00:00:00").toLocaleDateString("es-PY", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
            } />
          )}
          {evento.tipo_evento && (
            <InfoRow icon={<FileText className="h-4 w-4" />} label="Tipo" value={TIPOS_EVENTO_LABEL[evento.tipo_evento] ?? evento.tipo_evento} />
          )}
          {evento.tarifa_evento && (
            <InfoRow icon={<Building2 className="h-4 w-4" />} label="Tarifa" value={formatPYG(evento.tarifa_evento)} valueClass="font-bold text-primary" />
          )}
          {evento.ejecutivo && (
            <InfoRow icon={<User className="h-4 w-4" />} label="Ejecutivo" value={`${evento.ejecutivo.nombre} ${evento.ejecutivo.apellido}`} />
          )}
          {evento.notas && (
            <InfoRow icon={<FileText className="h-4 w-4" />} label="Notas" value={evento.notas} />
          )}
        </section>

        {/* Botón registrar gestión */}
        <Button
          onClick={() => setShowForm((v) => !v)}
          variant={showForm ? "outline" : "default"}
          className="w-full gap-2"
        >
          {showForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showForm ? "Cerrar formulario" : "Registrar gestión"}
        </Button>

        {/* Formulario de gestión */}
        {showForm && (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nueva gestión</h2>

            {/* Tipo de contacto */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TIPOS_GESTION.map(({ key, label, icon: Icon, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormTipo(key)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-smooth text-center",
                    formTipo === key
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary hover:border-primary/40"
                  )}
                >
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", formTipo === key ? "bg-primary/20" : color)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className={cn("text-xs font-bold", formTipo === key ? "text-primary" : "text-foreground")}>
                    {label}
                  </span>
                </button>
              ))}
            </div>

            {/* Resultado */}
            <div className="space-y-1.5">
              <Label>Resultado <span className="text-destructive">*</span></Label>
              <select
                value={resultadoId}
                onChange={(e) => setResultadoId(e.target.value)}
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">Seleccioná el resultado...</option>
                {tiposResultadoFiltrados.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea
                placeholder="Detalles de la gestión..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Próxima acción */}
            <div className="space-y-1.5">
              <Label>Próxima acción</Label>
              <Input
                type="date"
                value={proxima}
                onChange={(e) => setProxima(e.target.value)}
                className="h-11"
              />
            </div>

            <Button onClick={registrarGestion} disabled={guardando} className="w-full gap-2">
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {guardando ? "Guardando..." : "Guardar gestión"}
            </Button>
          </section>
        )}

        {/* Bitácora del evento */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
            Bitácora ({gestiones.length})
          </h2>

          {gestiones.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <p className="text-sm font-semibold text-muted-foreground">Sin gestiones aún</p>
              <p className="mt-1 text-xs text-muted-foreground">Registrá la primera gestión para este evento</p>
            </div>
          ) : (
            gestiones.map((g) => {
              const tipoInfo = TIPOS_GESTION.find((t) => t.key === g.tipo);
              const Icon = tipoInfo?.icon ?? FileText;
              return (
                <div key={g.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tipoInfo?.color ?? "bg-gray-100 text-gray-600")}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold capitalize">{g.tipo}</p>
                        <p className="text-[10px] text-muted-foreground shrink-0">{relativeDate(g.created_at)}</p>
                      </div>
                      {g.resultado && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-success">
                          <CheckCircle2 className="h-3 w-3" />
                          {g.resultado}
                        </p>
                      )}
                      {g.nota && <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{g.nota}</p>}
                      {g.fecha_inicio && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(g.fecha_inicio).toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      )}
                      {g.ejecutivo && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {g.ejecutivo.nombre} {g.ejecutivo.apellido}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </>
  );
};

const InfoRow = ({ icon, label, value, valueClass }: {
  icon: React.ReactNode; label: string; value: string; valueClass?: string;
}) => (
  <div className="flex items-start gap-3">
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
      {icon}
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("text-sm leading-snug", valueClass ?? "text-foreground")}>{value}</p>
    </div>
  </div>
);

export default EventoDetalle;
