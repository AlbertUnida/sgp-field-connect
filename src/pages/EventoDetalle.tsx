import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Car, PhoneCall, Mail, MessageCircle, Calendar,
  Building2, FileText, Loader2, CheckCircle2, Clock,
  ChevronDown, ChevronUp, Save, Pencil, User,
  MapPin, ImagePlus, Trash2, AlertCircle,
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
import { RESULTADOS_GESTION } from "@/lib/resultados-gestion";
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
  datos_extra: Record<string, unknown> | null;
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

// Resultados específicos para visita de evento (con score para lead scoring)
const RESULTADOS_EVENTO = [
  { key: "no_recibe_no_identifica",   label: "No recibe, No se identifica", score: -2 },
  { key: "no_recibe_no_firma",        label: "No recibe, No firma",          score: -1 },
  { key: "recibe_no_firma",           label: "Recibe y no firma",            score:  3 },
  { key: "evento_declarado",          label: "Evento Declarado",             score: 10 },
];

const EventoDetalle = () => {
  const { id: clienteId, eventoId } = useParams();
  const { user } = useAuth();
  const { canManage, nombreCompleto } = useProfile();
  const navigate = useNavigate();

  const [evento, setEvento] = useState<Evento | null>(null);
  const [gestiones, setGestiones] = useState<Gestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [tiposResultado, setTiposResultado] = useState<TipoResultado[]>([]);
  const [resultadosCompletados, setResultadosCompletados] = useState<Set<string>>(new Set());

  // Canal selector
  const [formTipo, setFormTipo] = useState("visita");

  // CON EVENTO / SIN EVENTO (solo para visita)
  const [conEvento, setConEvento] = useState<boolean | null>(null);

  // Tarea (solo visita CON EVENTO)
  const [resultadoId, setResultadoId] = useState("");

  // Receptor (visita CON EVENTO con receptor)
  const [receptorNombre, setReceptorNombre] = useState("");
  const [receptorApellido, setReceptorApellido] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [actaNro, setActaNro] = useState("");

  // Resultado específico de evento
  const [resultadoReal, setResultadoReal] = useState("");

  // Contacto por canal (Llamada / WhatsApp / Email)
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoApellido, setContactoApellido] = useState("");
  const [contactoTelefono, setContactoTelefono] = useState("");
  const [contactoEmail, setContactoEmail] = useState("");
  const [contactoFecha, setContactoFecha] = useState(new Date().toISOString().split("T")[0]);

  // Notas y próxima acción
  const [notas, setNotas] = useState("");
  const [proxima, setProxima] = useState("");

  // GPS
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsEstado, setGpsEstado] = useState<"idle" | "buscando" | "ok" | "error">("idle");

  // Foto
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  // Editar estado del evento
  const [editandoEstado, setEditandoEstado] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState("");
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  const resultadoSeleccionado = tiposResultado.find((t) => t.id === resultadoId) ?? null;
  const tipoFormulario = resultadoSeleccionado?.tipo_formulario ?? null;
  const mostrarReceptor = conEvento === true && (
    tipoFormulario === "nota_comercial" || tipoFormulario === "nota_reclamo" ||
    tipoFormulario === "visita_seguimiento" || tipoFormulario === "reunion"
  );

  // Tipos de resultado filtrados por cartera "evento"
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

  // Capturar GPS automáticamente al seleccionar VISITA
  useEffect(() => {
    if (formTipo !== "visita") {
      setGps(null); setGpsEstado("idle");
      return;
    }
    setGpsEstado("buscando");
    capturarGPSPromise().then((coords) => {
      if (coords) { setGps(coords); setGpsEstado("ok"); }
      else { setGpsEstado("error"); }
    });
  }, [formTipo]);

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
      .select("id, tipo, resultado, resultado_id, nota, fecha_inicio, created_at, datos_extra, ejecutivo:ejecutivo_id(nombre, apellido)")
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

  const capturarGPSPromise = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const aplicarMarcaDeAgua = (file: File, nombre: string): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const ahora = new Date();
        const fecha = ahora.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
        const hora = ahora.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const linea1 = nombre.toUpperCase();
        const linea2 = `${fecha}  •  ${hora}  •  SGP Paraguay`;
        const fontSize = Math.max(Math.round(img.width * 0.038), 22);
        const smallSize = Math.round(fontSize * 0.72);
        const padding = Math.round(fontSize * 0.7);
        const barHeight = fontSize + smallSize + padding * 2.5;
        ctx.fillStyle = "rgba(0, 0, 0, 0.70)";
        ctx.fillRect(0, img.height - barHeight, img.width, barHeight);
        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(0, img.height - barHeight, img.width, Math.round(fontSize * 0.18));
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.fillStyle = "#ffffff"; ctx.textBaseline = "top"; ctx.textAlign = "left";
        ctx.fillText(linea1, padding, img.height - barHeight + padding);
        ctx.font = `${smallSize}px Arial, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillText(linea2, padding, img.height - barHeight + padding + fontSize + Math.round(smallSize * 0.3));
        URL.revokeObjectURL(objectUrl);
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        }, "image/jpeg", 0.92);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    });
  };

  const seleccionarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const nombre = nombreCompleto || "Ejecutivo SGP";
    const fotoConMarca = await aplicarMarcaDeAgua(file, nombre);
    setFotoFile(fotoConMarca);
    setFotoPreview(URL.createObjectURL(fotoConMarca));
  };

  const quitarFoto = () => {
    setFotoFile(null); setFotoPreview(null);
    if (fotoInputRef.current) fotoInputRef.current.value = "";
  };

  const resetForm = () => {
    setConEvento(null);
    setResultadoId(""); setReceptorNombre(""); setReceptorApellido("");
    setFechaEntrega(""); setActaNro(""); setResultadoReal("");
    setContactoNombre(""); setContactoApellido("");
    setContactoTelefono(""); setContactoEmail("");
    setContactoFecha(new Date().toISOString().split("T")[0]);
    setNotas(""); setProxima("");
    quitarFoto();
  };

  const registrarGestion = async () => {
    if (!evento) return;

    // Validaciones según canal
    if (formTipo === "visita") {
      if (conEvento === null) { toast.error("Indicá si la visita fue CON EVENTO o SIN EVENTO"); return; }
      if (conEvento === true) {
        if (!resultadoId) { toast.error("Seleccioná la tarea realizada"); return; }
        if (mostrarReceptor && !receptorNombre.trim()) {
          toast.error("Ingresá el nombre de quien recibió / estuvo presente"); return;
        }
        if (!resultadoReal) { toast.error("Seleccioná el resultado de la gestión"); return; }
      }
    } else if (formTipo === "llamada" || formTipo === "whatsapp") {
      if (!contactoNombre.trim()) { toast.error("Ingresá el nombre del contacto"); return; }
      if (!resultadoReal) { toast.error("Seleccioná el resultado de la gestión"); return; }
    }
    // email: sin validación de resultado obligatorio

    setGuardando(true);

    // GPS fresco al guardar visita
    let coordenadas = gps;
    if (formTipo === "visita") {
      setGpsEstado("buscando");
      const fresh = await capturarGPSPromise();
      if (fresh) { coordenadas = fresh; setGps(fresh); setGpsEstado("ok"); }
      else { setGpsEstado("error"); coordenadas = null; }
    }

    // Subir foto si la hay
    let fotoUrl: string | null = null;
    if (fotoFile) {
      setSubiendoFoto(true);
      const ext = fotoFile.name.split(".").pop() ?? "jpg";
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("gestiones-fotos")
        .upload(path, fotoFile, { contentType: fotoFile.type, upsert: false });
      if (!uploadError) {
        fotoUrl = path; // A3: guardar path en lugar de URL pública (bucket privado)
      } else {
        toast.error("No se pudo subir la foto — se guardará sin imagen");
      }
      setSubiendoFoto(false);
    }

    // Construir datos_extra
    const datosExtra: Record<string, unknown> = {};

    if (formTipo === "visita") {
      datosExtra.con_evento = conEvento;
      if (conEvento === true) {
        if (mostrarReceptor) {
          datosExtra.receptor_nombre = receptorNombre.trim();
          datosExtra.receptor_apellido = receptorApellido.trim() || null;
          datosExtra.fecha_entrega = fechaEntrega || null;
          datosExtra.acta_nro = actaNro.trim() || null;
        }
        datosExtra.resultado_real = resultadoReal || null;
        // M1: guardar score para lead scoring (igual que locales)
        const rrEvento = RESULTADOS_EVENTO.find((r) => r.key === resultadoReal);
        datosExtra.score = rrEvento?.score ?? null;
      }
    } else if (formTipo === "llamada" || formTipo === "whatsapp") {
      datosExtra.contacto_nombre = contactoNombre.trim() || null;
      datosExtra.contacto_apellido = contactoApellido.trim() || null;
      datosExtra.contacto_telefono = contactoTelefono.trim() || null;
      datosExtra.contacto_fecha = contactoFecha || null;
      datosExtra.resultado_real = resultadoReal || null;
      const rrObj = RESULTADOS_GESTION.find((r) => r.key === resultadoReal);
      datosExtra.score = rrObj?.score ?? null;
    } else if (formTipo === "email") {
      datosExtra.contacto_nombre = contactoNombre.trim() || null;
      datosExtra.contacto_apellido = contactoApellido.trim() || null;
      datosExtra.contacto_email = contactoEmail.trim() || null;
      datosExtra.contacto_fecha = contactoFecha || null;
    }

    const resultadoText = formTipo === "visita" && conEvento === true
      ? (RESULTADOS_EVENTO.find((r) => r.key === resultadoReal)?.label ?? resultadoReal)
      : (formTipo === "llamada" || formTipo === "whatsapp")
        ? (RESULTADOS_GESTION.find((r) => r.key === resultadoReal)?.label ?? null)
        : null; // email: sin resultado inmediato

    const { error } = await supabase.from("gestiones").insert({
      cliente_id: evento.cliente_id,
      evento_id: eventoId,
      tipo: formTipo,
      resultado_id: formTipo === "visita" ? (resultadoId || null) : null,
      resultado: resultadoText,
      datos_extra: Object.keys(datosExtra).length > 0 ? datosExtra : null,
      nota: notas.trim() || null,
      proxima_accion: proxima || null,
      ejecutivo_id: user!.id,
      fecha_inicio: new Date().toISOString(),
      lat_inicio: coordenadas?.lat ?? null,
      lng_inicio: coordenadas?.lng ?? null,
      foto_url: fotoUrl,
    });

    if (error) { toast.error("Error al registrar: " + error.message); setGuardando(false); return; }

    toast.success("✅ Gestión registrada");
    resetForm();
    setShowForm(false);
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
          {evento.tarifa_evento != null && (
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
          onClick={() => { setShowForm((v) => !v); if (showForm) resetForm(); }}
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

            {/* Canal */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TIPOS_GESTION.map(({ key, label, icon: Icon, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setFormTipo(key);
                    resetForm();
                  }}
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

            {/* ── VISITA: toggle CON EVENTO / SIN EVENTO ── */}
            {formTipo === "visita" && (
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Acción <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setConEvento(true); setResultadoId(""); setResultadoReal(""); }}
                    className={cn(
                      "rounded-xl border py-3 text-sm font-bold transition-smooth",
                      conEvento === true
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    🎉 Con evento
                  </button>
                  <button
                    type="button"
                    onClick={() => { setConEvento(false); setResultadoId(""); setResultadoReal(""); }}
                    className={cn(
                      "rounded-xl border py-3 text-sm font-bold transition-smooth",
                      conEvento === false
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-border bg-secondary text-muted-foreground hover:border-amber-400/60"
                    )}
                  >
                    📋 Sin evento
                  </button>
                </div>
              </div>
            )}

            {/* ── VISITA CON EVENTO: flujo completo ── */}
            {formTipo === "visita" && conEvento === true && (
              <>
                {/* Tarea */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Tarea <span className="text-destructive">*</span>
                  </Label>
                  <select
                    value={resultadoId}
                    onChange={(e) => {
                      setResultadoId(e.target.value);
                      setReceptorNombre(""); setReceptorApellido("");
                      setFechaEntrega(new Date().toISOString().split("T")[0]);
                      setActaNro(""); setResultadoReal("");
                    }}
                    className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Seleccioná la tarea realizada...</option>
                    {tiposResultadoFiltrados.map((r) => (
                      <option key={r.id} value={r.id}>{r.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Receptor */}
                {mostrarReceptor && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">
                      📄 {resultadoSeleccionado?.nombre ?? "Datos del receptor"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Datos de quien recibió / estuvo presente.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Nombre <span className="text-destructive">*</span>
                        </Label>
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

                {/* Resultado específico de evento */}
                {resultadoId && (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Resultado <span className="text-destructive">*</span>
                      </p>
                    </div>
                    <select
                      value={resultadoReal}
                      onChange={(e) => setResultadoReal(e.target.value)}
                      className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="">¿Cuál fue el resultado?</option>
                      {RESULTADOS_EVENTO.map((r) => (
                        <option key={r.key} value={r.key}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Notas */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notas / Resumen</Label>
                  <Textarea
                    placeholder="Puntos clave conversados, acuerdos, observaciones..."
                    value={notas} onChange={(e) => setNotas(e.target.value)}
                    rows={3} className="resize-none"
                  />
                </div>

                {/* Próxima acción */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Próxima acción</Label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} className="h-11 pl-10" />
                  </div>
                </div>
              </>
            )}

            {/* ── VISITA SIN EVENTO: solo evidencia ── */}
            {formTipo === "visita" && conEvento === false && (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20 p-3">
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  📋 Solo se registrará la geolocalización y la foto como evidencia de la visita.
                </p>
              </div>
            )}

            {/* ── LLAMADA / WHATSAPP: bloque contacto + resultado ── */}
            {(formTipo === "llamada" || formTipo === "whatsapp") && (
              <>
                {/* Bloque contacto */}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    {formTipo === "llamada" ? "📞 Datos de la llamada" : "💬 Datos del WhatsApp"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Nombre <span className="text-destructive">*</span>
                      </Label>
                      <Input placeholder="Nombre" value={contactoNombre} onChange={(e) => setContactoNombre(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Apellido</Label>
                      <Input placeholder="Apellido" value={contactoApellido} onChange={(e) => setContactoApellido(e.target.value)} className="h-9 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nro. Teléfono</Label>
                      <Input placeholder="09X XXX XXX" value={contactoTelefono} onChange={(e) => setContactoTelefono(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fecha</Label>
                      <Input type="date" value={contactoFecha} onChange={(e) => setContactoFecha(e.target.value)} className="h-9 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Resultado */}
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Resultado <span className="text-destructive">*</span>
                    </p>
                  </div>
                  <select
                    value={resultadoReal}
                    onChange={(e) => setResultadoReal(e.target.value)}
                    className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="">¿Cuál fue el resultado?</option>
                    {RESULTADOS_GESTION.map((r) => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                </div>

                {/* Notas */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notas</Label>
                  <Textarea
                    placeholder="Detalles de la gestión..."
                    value={notas} onChange={(e) => setNotas(e.target.value)}
                    rows={3} className="resize-none"
                  />
                </div>

                {/* Próxima acción */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Próxima acción</Label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} className="h-11 pl-10" />
                  </div>
                </div>
              </>
            )}

            {/* ── EMAIL: bloque contacto sin resultado ── */}
            {formTipo === "email" && (
              <>
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">✉️ Datos del destinatario</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nombre</Label>
                      <Input placeholder="Nombre" value={contactoNombre} onChange={(e) => setContactoNombre(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Apellido</Label>
                      <Input placeholder="Apellido" value={contactoApellido} onChange={(e) => setContactoApellido(e.target.value)} className="h-9 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</Label>
                      <Input type="email" placeholder="correo@ejemplo.com" value={contactoEmail} onChange={(e) => setContactoEmail(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fecha</Label>
                      <Input type="date" value={contactoFecha} onChange={(e) => setContactoFecha(e.target.value)} className="h-9 text-sm" />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground italic">El resultado se registrará cuando llegue la respuesta.</p>
                </div>

                {/* Notas */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notas</Label>
                  <Textarea
                    placeholder="Detalles del email enviado..."
                    value={notas} onChange={(e) => setNotas(e.target.value)}
                    rows={3} className="resize-none"
                  />
                </div>

                {/* Próxima acción */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Próxima acción</Label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} className="h-11 pl-10" />
                  </div>
                </div>
              </>
            )}

            {/* ── GPS + FOTO: visible en VISITA (cualquier acción) ── */}
            {formTipo === "visita" && conEvento !== null && (
              <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Evidencia de visita</p>
                <div className="grid grid-cols-2 gap-2">

                  {/* GPS */}
                  <div className={cn(
                    "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3",
                    gpsEstado === "ok" ? "border-success/40 bg-success/5"
                    : gpsEstado === "error" ? "border-destructive/40 bg-destructive/5"
                    : "border-dashed border-border bg-secondary/40"
                  )}>
                    {gpsEstado === "buscando" ? (
                      <><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="text-[11px] font-semibold text-muted-foreground text-center">Obteniendo...</span></>
                    ) : gpsEstado === "ok" && gps ? (
                      <><MapPin className="h-5 w-5 text-success" />
                      <span className="text-[11px] font-semibold text-success">Ubicación ✓</span>
                      <span className="text-[10px] text-muted-foreground text-center">{gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}</span></>
                    ) : gpsEstado === "error" ? (
                      <><MapPin className="h-5 w-5 text-destructive" />
                      <span className="text-[11px] font-semibold text-destructive">Sin GPS</span>
                      <span className="text-[10px] text-muted-foreground text-center">Habilitá la ubicación</span></>
                    ) : (
                      <><MapPin className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">GPS pendiente</span></>
                    )}
                  </div>

                  {/* Foto */}
                  <div>
                    <input ref={fotoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={seleccionarFoto} />
                    {fotoPreview ? (
                      <div className="relative h-full min-h-[88px] overflow-hidden rounded-xl border border-success/40">
                        <img src={fotoPreview} alt="Foto de visita" className="h-full w-full object-cover" style={{ minHeight: 88 }} />
                        <button type="button" onClick={quitarFoto} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
                          <Trash2 className="h-3 w-3" />
                        </button>
                        <span className="absolute bottom-1 left-1.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-bold text-white">✓ Foto lista</span>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fotoInputRef.current?.click()}
                        className="flex h-full min-h-[88px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-secondary/40 p-3 text-muted-foreground transition-smooth hover:border-primary/40 hover:text-primary">
                        <ImagePlus className="h-5 w-5" />
                        <span className="text-[11px] font-semibold">Sacar foto</span>
                        <span className="text-[10px]">Evidencia de visita</span>
                      </button>
                    )}
                  </div>
                </div>
                {gpsEstado === "error" && (
                  <p className="text-[11px] text-destructive font-semibold">
                    ⚠️ La visita se guardará sin coordenadas. El sistema registrará el intento fallido.
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={registrarGestion}
              disabled={guardando || subiendoFoto}
              className="w-full gap-2 h-11"
            >
              {guardando || subiendoFoto
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Save className="h-4 w-4" />}
              {subiendoFoto ? "Subiendo foto..." : guardando ? "Guardando..." : "Guardar en bitácora"}
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
              const de = g.datos_extra as any;
              return (
                <div key={g.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tipoInfo?.color ?? "bg-gray-100 text-gray-600")}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold capitalize">{g.tipo}</p>
                          {/* Badge CON/SIN EVENTO */}
                          {de?.con_evento === true && (
                            <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[9px] font-bold uppercase">Con evento</span>
                          )}
                          {de?.con_evento === false && (
                            <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[9px] font-bold uppercase">Sin evento</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground shrink-0">{relativeDate(g.created_at)}</p>
                      </div>
                      {g.resultado && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-success">
                          <CheckCircle2 className="h-3 w-3" />
                          {g.resultado}
                        </p>
                      )}
                      {de?.resultado_real && g.tipo === "visita" && (
                        <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                          → {RESULTADOS_EVENTO.find((r) => r.key === de.resultado_real)?.label ?? de.resultado_real}
                        </p>
                      )}
                      {de?.resultado_real && (g.tipo === "llamada" || g.tipo === "whatsapp") && (
                        <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                          → {RESULTADOS_GESTION.find((r) => r.key === de.resultado_real)?.label ?? de.resultado_real}
                        </p>
                      )}
                      {/* Datos de contacto (llamada / whatsapp / email) */}
                      {de?.contacto_nombre && (
                        <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 space-y-0.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            {g.tipo === "llamada" ? "📞 Contacto" : g.tipo === "whatsapp" ? "💬 Contacto" : "✉️ Destinatario"}
                          </p>
                          <p className="text-xs text-foreground">{[de.contacto_nombre, de.contacto_apellido].filter(Boolean).join(" ")}</p>
                          {de.contacto_telefono && (
                            <p className="text-xs text-muted-foreground">Tel: {de.contacto_telefono}</p>
                          )}
                          {de.contacto_email && (
                            <p className="text-xs text-muted-foreground">{de.contacto_email}</p>
                          )}
                          {de.contacto_fecha && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(de.contacto_fecha + "T00:00:00").toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })}
                            </p>
                          )}
                        </div>
                      )}
                      {de?.receptor_nombre && (
                        <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 space-y-0.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">📄 Receptor</p>
                          <p className="text-xs text-foreground">{[de.receptor_nombre, de.receptor_apellido].filter(Boolean).join(" ")}</p>
                          {de.fecha_entrega && (
                            <p className="text-xs text-muted-foreground">
                              Fecha: {new Date(de.fecha_entrega + "T00:00:00").toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })}
                            </p>
                          )}
                          {de.acta_nro && <p className="text-xs text-muted-foreground">Acta Nro.: {de.acta_nro}</p>}
                        </div>
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
  icon: React.ReactNode; label: string; value: string | null; valueClass?: string;
}) => (
  <div className="flex items-start gap-3">
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
      {icon}
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("text-sm leading-snug", valueClass ?? "text-foreground")}>{value ?? "—"}</p>
    </div>
  </div>
);

export default EventoDetalle;
