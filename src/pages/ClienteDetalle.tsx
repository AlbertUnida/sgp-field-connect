import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, MapPin, Phone, Building2, FileText, Calendar,
  Plus, Car, PhoneCall, Mail, CheckCircle2, Clock, Loader2,
  ChevronDown, ChevronUp, User, UserCheck, Pencil, MessageCircle,
  AlertTriangle, RotateCcw, Camera, AlertCircle, X, Target
} from "lucide-react";
import { RESULTADOS_GESTION } from "@/lib/resultados-gestion";
import { getLeadScoreInfo, scoreHeaderClasses } from "@/lib/lead-score";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { formatPYG } from "@/lib/mock-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Cliente {
  id: number;
  numero_cliente: number | null;
  nombre_comercial: string;
  razon_social: string | null;
  ruc: string | null;
  telefono: string | null;
  email_cliente: string | null;
  ciudad: string | null;
  localidad: string | null;
  barrio: string | null;
  direccion: string | null;
  calle_secundaria: string | null;
  instancia: string | null;
  estado: string | null;
  tarifa_mensual: number | null;
  ejecutivo_id: string | null;
  creado_por: string | null;
  activo: boolean;
  notas: string | null;
  tipo_cliente: string | null;
  nombre_salon: string | null;
  capacidad: number | null;
  categoria: { nombre: string } | null;
  rubro_rel: { nombre: string } | null;
  sub_rubro_id: string | null;
  fecha_vencimiento: string | null;
  created_at: string | null;
}

interface TipoResultado {
  id: string;
  nombre: string;
  tipo_formulario: "sin_medios" | "nota_comercial" | "nota_reclamo" | "visita_seguimiento" | "reunion" | null;
  tipo_cartera: string;
  activo: boolean;
  orden: number;
}

interface Gestion {
  id: number;
  tipo: string;
  resultado: string | null;
  resultado_id: string | null;
  datos_extra: Record<string, unknown> | null;
  nota: string | null;
  fecha_inicio: string | null;
  created_at: string;
  foto_url: string | null;
  ejecutivo: { nombre: string; apellido: string } | null;
}

interface CobroCliente {
  id: number;
  monto: number;
  metodo_pago: string | null;
  modalidad: string | null;
  fecha_cobro: string;
  periodo_desde: string | null;
  periodo_hasta: string | null;
  notas: string | null;
  registrado_por_nombre: string | null;
  razon_social_factura?: string | null;
  ruc_factura?: string | null;
  eventos_ids?: string[] | null;
}

interface HistorialInstancia {
  id: number;
  instancia_anterior: string | null;
  instancia_nueva: string;
  created_at: string;
  ejecutivo: { nombre: string; apellido: string } | null;
}

interface EventoAgenda {
  id: string;
  numero_evento: number;
  nombre_evento: string | null;
  fecha_evento: string | null;
  tipo_evento: string | null;
  tarifa_evento: number | null;
  estado: string;
}

const TIPOS_GESTION = [
  { key: "visita",    label: "Visita",     icon: Car,       color: "bg-blue-100 text-blue-700" },
  { key: "llamada",   label: "Llamada",    icon: PhoneCall, color: "bg-green-100 text-green-700" },
  { key: "email",     label: "Email",      icon: Mail,      color: "bg-purple-100 text-purple-700" },
  { key: "whatsapp",  label: "WhatsApp",   icon: MessageCircle, color: "bg-emerald-100 text-emerald-700" },
];


const INSTANCIA_COLORS: Record<string, string> = {
  CENSO: "bg-gray-500",
  COMERCIAL: "bg-blue-600",
  COBRANZAS: "bg-green-600",
  JURIDICO: "bg-red-600",
};

interface EjecutivoOpcion {
  id: string;
  nombre: string | null;
  apellido: string | null;
}

const ClienteDetalle = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { isAdmin, canManage } = useProfile();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [subRubroNombre, setSubRubroNombre] = useState<string | null>(null);
  const [gestiones, setGestiones] = useState<Gestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [showDatosLocal, setShowDatosLocal] = useState(true);
  const [showRelevamiento, setShowRelevamiento] = useState(false);

  // Eventos agenda (para clientes tipo "evento")
  const [eventosAgenda, setEventosAgenda] = useState<EventoAgenda[]>([]);
  const [loadingEventos, setLoadingEventos] = useState(false);

  // Formulario inline de nuevo evento
  const eventoFormVacio = { nombre_evento: "", fecha_evento: "", tipo_evento: "", tarifa_evento: "", notas: "" };
  const [showFormEvento, setShowFormEvento] = useState(false);
  const [formEvento, setFormEvento] = useState(eventoFormVacio);
  const [guardandoEvento, setGuardandoEvento] = useState(false);
  const setEv = (k: string, v: string) => setFormEvento((p) => ({ ...p, [k]: v }));

  // Historial de instancias
  const [historial, setHistorial] = useState<HistorialInstancia[]>([]);

  // Historial de cobros
  const [cobrosCliente, setCobrosCliente] = useState<CobroCliente[]>([]);
  const [loadingCobros, setLoadingCobros] = useState(false);

  // Cobro
  const [showCobro, setShowCobro] = useState(false);
  const [guardandoCobro, setGuardandoCobro] = useState(false);
  const hoy = new Date().toISOString().split("T")[0];
  const [cobro, setCobro] = useState({
    monto: "",
    metodo_pago: "efectivo",
    modalidad: "mensual",
    fecha_cobro: hoy,
    periodo_desde: hoy,
    periodo_hasta: "",
    referencia: "",
    notas: "",
  });
  const setCob = (key: string, val: string) => setCobro((p) => ({ ...p, [key]: val }));

  // Cobro por lotes (eventos)
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [eventosSeleccionados, setEventosSeleccionados] = useState<Set<string>>(new Set());
  const [showCobroEventos, setShowCobroEventos] = useState(false);
  const [guardandoCobroEv, setGuardandoCobroEv] = useState(false);
  const [cobroEv, setCobroEv] = useState({
    monto: "",
    metodo_pago: "efectivo",
    modalidad: "pago_unico",
    fecha_cobro: hoy,
    razon_social_factura: "",
    ruc_factura: "",
    notas: "",
  });
  const setCobEv = (k: string, v: string) => setCobroEv((p) => ({ ...p, [k]: v }));

  // Renovar licencia (COBRANZAS → COMERCIAL)
  const [renovando, setRenovando] = useState(false);

  // Escalación a JURÍDICO
  const [showJuridico, setShowJuridico] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [escalando, setEscalando] = useState(false);

  // Recuperar desde JURÍDICO (volver a COMERCIAL)
  const [showRecuperar, setShowRecuperar] = useState(false);
  const [motivoRecuperar, setMotivoRecuperar] = useState("");
  const [recuperando, setRecuperando] = useState(false);

  // Asignación de ejecutivo (solo admin)
  const [ejecutivos, setEjecutivos] = useState<EjecutivoOpcion[]>([]);
  const [ejecutivoSeleccionado, setEjecutivoSeleccionado] = useState("");
  const [asignando, setAsignando] = useState(false);

  const [form, setForm] = useState({
    tipo: "visita",
    notas: "",
    proxima_accion: "",
  });

  // Tipos de resultado dinámicos
  const [tiposResultado, setTiposResultado] = useState<TipoResultado[]>([]);
  const [cargandoResultados, setCargandoResultados] = useState(false);
  const [resultadoId, setResultadoId] = useState("");

  // Campos especiales según tipo_formulario (VISITA)
  const [receptorNombre, setReceptorNombre] = useState("");
  const [receptorApellido, setReceptorApellido] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [actaNro, setActaNro] = useState("");

  // Contacto por canal (Llamada / WhatsApp / Email)
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoApellido, setContactoApellido] = useState("");
  const [contactoTelefono, setContactoTelefono] = useState("");
  const [contactoEmail, setContactoEmail] = useState("");
  const [contactoFecha, setContactoFecha] = useState(new Date().toISOString().split("T")[0]);

  // Resultado real de la gestión
  const [resultadoReal, setResultadoReal] = useState("");
  const resultadoRealObj = RESULTADOS_GESTION.find((r) => r.key === resultadoReal) ?? null;

  // Helpers por canal
  const mostrarTarea = form.tipo === "visita";
  const mostrarResultado = form.tipo !== "email" && (form.tipo !== "visita" || !!resultadoId);

  // Computed: resultado seleccionado y su tipo de formulario
  const resultadoSeleccionado = tiposResultado.find((t) => t.id === resultadoId) ?? null;
  const tipoFormulario = resultadoSeleccionado?.tipo_formulario ?? null;

  // Filtrado por cartera + filtrado secuencial de nota_reclamo
  const tiposResultadoFiltrados = (() => {
    const tipoCarteraCliente = cliente?.tipo_cliente ?? "local";
    // Filtrar por cartera: mostrar solo los que aplican a este tipo de cliente
    const porCartera = tiposResultado.filter(
      (t) => t.tipo_cartera === "ambos" || t.tipo_cartera === tipoCarteraCliente
    );
    const completedIds = new Set<string>(gestiones.map((g) => g.resultado_id).filter(Boolean) as string[]);
    const notaReclamo = porCartera
      .filter((t) => t.tipo_formulario === "nota_reclamo")
      .sort((a, b) => a.orden - b.orden);
    const proxPendiente = notaReclamo.find((t) => !completedIds.has(t.id));
    return [
      ...porCartera.filter((t) => t.tipo_formulario !== "nota_reclamo"),
      ...(proxPendiente ? [proxPendiente] : []),
    ];
  })();

  const esPropio = cliente?.ejecutivo_id === user?.id;
  // Ejecutivo que creó el cliente mientras está en CENSO (puede editar para cargar tarifa)
  const esCreadorCenso = cliente?.creado_por === user?.id && cliente?.instancia === "CENSO";

  useEffect(() => {
    if (!id) return;
    cargarCliente();
    cargarGestiones();
    cargarHistorial();
    cargarCobros();
    cargarResultados();
  }, [id]);

  // Cargar eventos cuando ya sabemos que es tipo "evento"
  useEffect(() => {
    if (cliente?.tipo_cliente === "evento") {
      cargarEventos();
    }
  }, [cliente?.tipo_cliente]);

  const cargarEventos = async () => {
    setLoadingEventos(true);
    const { data } = await supabase
      .from("eventos_agenda")
      .select("id, numero_evento, nombre_evento, fecha_evento, tipo_evento, tarifa_evento, estado")
      .eq("cliente_id", parseInt(id!))
      .order("fecha_evento", { ascending: true });
    setEventosAgenda(data ?? []);
    setLoadingEventos(false);
  };

  const guardarEvento = async (abrirOtro: boolean) => {
    if (!formEvento.nombre_evento.trim()) { toast.error("El nombre del evento es obligatorio"); return; }
    if (!formEvento.fecha_evento) { toast.error("La fecha del evento es obligatoria"); return; }
    if (!formEvento.tipo_evento) { toast.error("Seleccioná el tipo de evento"); return; }

    setGuardandoEvento(true);
    const { error } = await supabase.from("eventos_agenda").insert({
      cliente_id: parseInt(id!),
      nombre_evento: formEvento.nombre_evento.trim(),
      fecha_evento: formEvento.fecha_evento,
      tipo_evento: formEvento.tipo_evento,
      tarifa_evento: formEvento.tarifa_evento ? parseInt(formEvento.tarifa_evento.replace(/\D/g, "")) : null,
      notas: formEvento.notas.trim() || null,
      estado: "prospecto",
      ejecutivo_id: user!.id,
      created_by: user!.id,
    });

    if (error) { toast.error("Error al guardar evento: " + error.message); setGuardandoEvento(false); return; }

    toast.success("✅ Evento guardado");
    await cargarEventos();
    setGuardandoEvento(false);

    if (abrirOtro) {
      // Limpiar form y quedarse listo para el siguiente evento
      setFormEvento(eventoFormVacio);
    } else {
      setFormEvento(eventoFormVacio);
      setShowFormEvento(false);
    }
  };

  const cargarResultados = async () => {
    setCargandoResultados(true);
    const { data } = await supabase
      .from("tipos_resultado")
      .select("id, nombre, tipo_formulario, tipo_cartera, activo, orden")
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });
    setTiposResultado(data ?? []);
    setCargandoResultados(false);
  };

  const handleResultadoChange = (id: string) => {
    setResultadoId(id);
    setReceptorNombre(""); setReceptorApellido(""); setFechaEntrega(""); setActaNro("");
    setResultadoReal("");
    // Auto-completar fecha de hoy para tareas con receptor
    const tipo = tiposResultado.find((t) => t.id === id);
    if (
      tipo?.tipo_formulario === "nota_comercial" ||
      tipo?.tipo_formulario === "nota_reclamo" ||
      tipo?.tipo_formulario === "visita_seguimiento" ||
      tipo?.tipo_formulario === "reunion"
    ) {
      setFechaEntrega(new Date().toISOString().split("T")[0]);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    supabase
      .from("profiles")
      .select("id, nombre, apellido")
      .in("rol", ["ejecutivo", "supervisor"])
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setEjecutivos(data ?? []));
  }, [canManage]);

  const cargarCliente = async () => {
    const { data, error } = await supabase
      .from("clientes")
      .select(`
        *,
        categoria:categoria_id(nombre),
        rubro_rel:rubro_id(nombre)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      toast.error("Cliente no encontrado");
      navigate("/app/clientes");
      return;
    }
    setCliente(data);

    // Sub rubro — carga separada para no romper la query principal
    if (data.sub_rubro_id) {
      supabase
        .from("sub_rubros")
        .select("nombre")
        .eq("id", data.sub_rubro_id)
        .single()
        .then(({ data: sr }) => setSubRubroNombre(sr?.nombre ?? null));
    } else {
      setSubRubroNombre(null);
    }

    setLoading(false);
  };

  const cargarHistorial = async () => {
    const { data } = await supabase
      .from("historial_instancias")
      .select("id, instancia_anterior, instancia_nueva, created_at, ejecutivo:ejecutivo_id(nombre, apellido)")
      .eq("cliente_id", id)
      .order("created_at", { ascending: true });
    setHistorial((data ?? []) as HistorialInstancia[]);
  };

  const cargarCobros = async () => {
    setLoadingCobros(true);
    const { data } = await supabase
      .from("cobros")
      .select(`
        id, monto, metodo_pago, modalidad, fecha_cobro,
        periodo_desde, periodo_hasta, notas,
        razon_social_factura, ruc_factura, eventos_ids,
        registrado_por:registrado_por(nombre, apellido)
      `)
      .eq("cliente_id", id)
      .order("fecha_cobro", { ascending: false });

    const mapped = (data ?? []).map((c: any) => ({
      ...c,
      registrado_por_nombre: c.registrado_por
        ? `${c.registrado_por.nombre ?? ""} ${c.registrado_por.apellido ?? ""}`.trim()
        : null,
    }));
    setCobrosCliente(mapped);
    setLoadingCobros(false);
  };

  const cargarGestiones = async () => {
    const { data } = await supabase
      .from("gestiones")
      .select(`
        id, tipo, resultado, resultado_id, datos_extra, nota, fecha_inicio, created_at, foto_url,
        ejecutivo:ejecutivo_id(nombre, apellido)
      `)
      .eq("cliente_id", id)
      .order("created_at", { ascending: false });

    setGestiones((data ?? []) as Gestion[]);
  };

  const asignarEjecutivo = async () => {
    if (!ejecutivoSeleccionado) { toast.error("Seleccioná un ejecutivo"); return; }

    if (!cliente?.tarifa_mensual) {
      toast.error("El cliente debe tener una Tarifa Mensual antes de pasar a COMERCIAL");
      return;
    }

    setAsignando(true);

    const instanciaAnterior = cliente?.instancia ?? "CENSO";

    const { error } = await supabase.from("clientes").update({
      ejecutivo_id: ejecutivoSeleccionado,
      instancia: "COMERCIAL",
    }).eq("id", id);

    if (error) {
      toast.error("Error al asignar: " + error.message);
      setAsignando(false);
      return;
    }

    // Registrar la transición en el historial solo si la instancia cambió
    if (instanciaAnterior !== "COMERCIAL") {
      await supabase.from("historial_instancias").insert({
        cliente_id: parseInt(id!),
        instancia_anterior: instanciaAnterior,
        instancia_nueva: "COMERCIAL",
        ejecutivo_id: user!.id,
      });
    }

    toast.success("Ejecutivo asignado — cliente pasa a COMERCIAL ✅");
    setEjecutivoSeleccionado("");
    await cargarCliente();
    await cargarHistorial();
    setAsignando(false);
  };

  const registrarCobro = async () => {
    if (!cobro.monto) { toast.error("Ingresá el monto cobrado"); return; }
    if (!cobro.fecha_cobro) { toast.error("Ingresá la fecha del cobro"); return; }

    setGuardandoCobro(true);

    const { error } = await supabase.from("cobros").insert({
      cliente_id: parseInt(id!),
      ejecutivo_id: cliente!.ejecutivo_id,
      registrado_por: user!.id,
      monto: parseFloat(cobro.monto.replace(/\D/g, "")),
      metodo_pago: cobro.metodo_pago,
      modalidad: cobro.modalidad,
      fecha_cobro: cobro.fecha_cobro,
      periodo_desde: cobro.periodo_desde || null,
      periodo_hasta: cobro.periodo_hasta || null,
      referencia: cobro.referencia || null,
      notas: cobro.notas || null,
    });

    if (error) {
      toast.error("Error al registrar cobro: " + error.message);
      setGuardandoCobro(false);
      return;
    }

    // Calcular fecha_vencimiento según días de vigencia del rubro
    const { data: rubroInfo } = await supabase
      .from("clientes")
      .select("rubro_rel:rubro_id(dias_vigencia)")
      .eq("id", id)
      .single();
    const diasVigencia = (rubroInfo?.rubro_rel as any)?.dias_vigencia ?? 30;
    const fechaBase = new Date(cobro.fecha_cobro);
    fechaBase.setDate(fechaBase.getDate() + diasVigencia);
    const fechaVencimiento = fechaBase.toISOString().split("T")[0];

    // Mover cliente a COBRANZAS y guardar vencimiento
    const instanciaAnterior = cliente!.instancia ?? "COMERCIAL";
    await supabase.from("clientes")
      .update({ instancia: "COBRANZAS", fecha_vencimiento: fechaVencimiento })
      .eq("id", id);

    // Registrar transición en historial
    await supabase.from("historial_instancias").insert({
      cliente_id: parseInt(id!),
      instancia_anterior: instanciaAnterior,
      instancia_nueva: "COBRANZAS",
      ejecutivo_id: user!.id,
      notas: `Cobro registrado: ${cobro.modalidad} — ${cobro.metodo_pago}`,
    });

    toast.success("Cobro registrado — cliente pasa a COBRANZAS ✅");
    setCobro({ monto: "", metodo_pago: "efectivo", modalidad: "mensual",
      fecha_cobro: hoy, periodo_desde: hoy, periodo_hasta: "", referencia: "", notas: "" });
    setShowCobro(false);
    await Promise.all([cargarCliente(), cargarCobros()]);
    await cargarHistorial();
    setGuardandoCobro(false);
  };

  // ── Cobro por lotes (eventos) ──────────────────────────────────────────────
  const toggleEventoSeleccionado = (evId: string) => {
    setEventosSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(evId)) next.delete(evId);
      else next.add(evId);
      return next;
    });
  };

  const abrirCobroEventos = () => {
    const evsSel = eventosAgenda.filter((ev) => eventosSeleccionados.has(ev.id));
    const totalTarifas = evsSel.reduce((s, ev) => s + (ev.tarifa_evento ?? 0), 0);
    setCobroEv({
      monto: totalTarifas > 0 ? String(totalTarifas) : "",
      metodo_pago: "efectivo",
      modalidad: "pago_unico",
      fecha_cobro: hoy,
      razon_social_factura: cliente?.razon_social ?? "",
      ruc_factura: cliente?.ruc ?? "",
      notas: "",
    });
    setShowCobroEventos(true);
  };

  const registrarCobroEventos = async () => {
    if (eventosSeleccionados.size === 0) { toast.error("Seleccioná al menos un evento"); return; }
    if (!cobroEv.monto) { toast.error("Ingresá el monto cobrado"); return; }
    if (!cobroEv.fecha_cobro) { toast.error("Ingresá la fecha del cobro"); return; }

    setGuardandoCobroEv(true);

    const montoNum = parseFloat(cobroEv.monto.replace(/\D/g, ""));
    const eventosSelArr = Array.from(eventosSeleccionados);
    const eventosNombres = eventosAgenda
      .filter((ev) => eventosSeleccionados.has(ev.id))
      .map((ev) => `EV-${String(ev.numero_evento).padStart(3, "0")}`)
      .join(", ");

    const { error } = await supabase.from("cobros").insert({
      cliente_id: parseInt(id!),
      ejecutivo_id: cliente!.ejecutivo_id,
      registrado_por: user!.id,
      monto: montoNum,
      metodo_pago: cobroEv.metodo_pago,
      modalidad: cobroEv.modalidad,
      fecha_cobro: cobroEv.fecha_cobro,
      razon_social_factura: cobroEv.razon_social_factura || null,
      ruc_factura: cobroEv.ruc_factura || null,
      eventos_ids: eventosSelArr,
      notas: cobroEv.notas || null,
    });

    if (error) { toast.error("Error al registrar cobro: " + error.message); setGuardandoCobroEv(false); return; }

    // Marcar los eventos cobrados como "cerrado"
    await supabase
      .from("eventos_agenda")
      .update({ estado: "cerrado" })
      .in("id", eventosSelArr);

    // El cliente de eventos siempre queda en COMERCIAL — no se mueve a COBRANZAS

    toast.success(`✅ Cobro de ${eventosSeleccionados.size} evento(s) registrado — ${eventosNombres}`);
    setEventosSeleccionados(new Set());
    setShowCobroEventos(false);
    setModoSeleccion(false);
    setCobroEv({ monto: "", metodo_pago: "efectivo", modalidad: "pago_unico", fecha_cobro: hoy, razon_social_factura: "", ruc_factura: "", notas: "" });
    await Promise.all([cargarCliente(), cargarCobros(), cargarHistorial()]);
    setGuardandoCobroEv(false);
  };
  // ────────────────────────────────────────────────────────────────────────────

  const renovarLicencia = async () => {
    setRenovando(true);

    const { error } = await supabase.from("clientes")
      .update({ instancia: "COMERCIAL" })
      .eq("id", id);

    if (error) {
      toast.error("Error al renovar: " + error.message);
      setRenovando(false);
      return;
    }

    await supabase.from("historial_instancias").insert({
      cliente_id: parseInt(id!),
      instancia_anterior: "COBRANZAS",
      instancia_nueva: "COMERCIAL",
      ejecutivo_id: user!.id,
      notas: "Renovación de licencia — vuelve a gestión comercial",
    });

    toast.success("Licencia en renovación — cliente pasa a COMERCIAL 🔄");
    await cargarCliente();
    await cargarHistorial();
    setRenovando(false);
  };

  const escalarJuridico = async () => {
    if (!motivo.trim()) { toast.error("Ingresá el motivo de la escalación"); return; }

    setEscalando(true);
    const instanciaAnterior = cliente!.instancia ?? "COBRANZAS";

    const { error } = await supabase.from("clientes")
      .update({ instancia: "JURIDICO" })
      .eq("id", id);

    if (error) {
      toast.error("Error al escalar: " + error.message);
      setEscalando(false);
      return;
    }

    await supabase.from("historial_instancias").insert({
      cliente_id: parseInt(id!),
      instancia_anterior: instanciaAnterior,
      instancia_nueva: "JURIDICO",
      ejecutivo_id: user!.id,
      notas: motivo.trim(),
    });

    toast.success("Cliente escalado a JURÍDICO");
    setMotivo("");
    setShowJuridico(false);
    await cargarCliente();
    await cargarHistorial();
    setEscalando(false);
  };

  const recuperarCliente = async () => {
    if (!motivoRecuperar.trim()) { toast.error("Ingresá una observación para la recuperación"); return; }

    setRecuperando(true);

    const { error } = await supabase.from("clientes")
      .update({ instancia: "COMERCIAL" })
      .eq("id", id);

    if (error) {
      toast.error("Error al recuperar: " + error.message);
      setRecuperando(false);
      return;
    }

    await supabase.from("historial_instancias").insert({
      cliente_id: parseInt(id!),
      instancia_anterior: "JURIDICO",
      instancia_nueva: "COMERCIAL",
      ejecutivo_id: user!.id,
      notas: motivoRecuperar.trim(),
    });

    toast.success("Cliente recuperado — vuelve a COMERCIAL ✅");
    setMotivoRecuperar("");
    setShowRecuperar(false);
    await cargarCliente();
    await cargarHistorial();
    setRecuperando(false);
  };

  const registrarActividad = async () => {
    if (!form.tipo) { toast.error("Seleccioná el tipo de gestión"); return; }

    // Validaciones por canal
    if (form.tipo === "visita") {
      if (!resultadoId) { toast.error("Seleccioná la tarea realizada"); return; }
      if (!resultadoReal) { toast.error("Seleccioná el resultado de la gestión"); return; }
      if (
        (tipoFormulario === "nota_comercial" || tipoFormulario === "nota_reclamo" ||
         tipoFormulario === "visita_seguimiento" || tipoFormulario === "reunion") &&
        !receptorNombre.trim()
      ) {
        toast.error("Ingresá el nombre de quien estuvo presente"); return;
      }
    } else if (form.tipo === "llamada" || form.tipo === "whatsapp") {
      if (!contactoNombre.trim()) { toast.error("Ingresá el nombre del contacto"); return; }
      if (!resultadoReal) { toast.error("Seleccioná el resultado de la gestión"); return; }
    }

    setGuardando(true);

    // Construir datos_extra según canal
    const datosExtra: Record<string, unknown> = {};
    if (form.tipo === "visita") {
      if (
        tipoFormulario === "nota_comercial" || tipoFormulario === "nota_reclamo" ||
        tipoFormulario === "visita_seguimiento" || tipoFormulario === "reunion"
      ) {
        datosExtra.receptor_nombre = receptorNombre.trim();
        datosExtra.receptor_apellido = receptorApellido.trim() || null;
        datosExtra.fecha_entrega = fechaEntrega || null;
        datosExtra.acta_nro = actaNro.trim() || null;
      }
      datosExtra.resultado_real = resultadoReal || null;
      datosExtra.score = resultadoRealObj?.score ?? null;
    } else if (form.tipo === "llamada" || form.tipo === "whatsapp") {
      datosExtra.contacto_nombre = contactoNombre.trim() || null;
      datosExtra.contacto_apellido = contactoApellido.trim() || null;
      datosExtra.contacto_telefono = contactoTelefono.trim() || null;
      datosExtra.contacto_fecha = contactoFecha || null;
      datosExtra.resultado_real = resultadoReal || null;
      datosExtra.score = resultadoRealObj?.score ?? null;
    } else if (form.tipo === "email") {
      datosExtra.contacto_nombre = contactoNombre.trim() || null;
      datosExtra.contacto_apellido = contactoApellido.trim() || null;
      datosExtra.contacto_email = contactoEmail.trim() || null;
      datosExtra.contacto_fecha = contactoFecha || null;
    }

    // Auto proxima_accion según resultado real
    const autoAgenda = form.tipo !== "email" && (resultadoRealObj?.autoAgenda ?? false);
    const proximaFinal = autoAgenda
      ? (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; })()
      : form.proxima_accion || null;

    const { error } = await supabase.from("gestiones").insert({
      cliente_id: parseInt(id!),
      ejecutivo_id: user!.id,
      tipo: form.tipo,
      resultado: resultadoSeleccionado?.nombre || null,
      resultado_id: resultadoId || null,          // null cuando no hay TAREA (Llamada/Email/WA)
      datos_extra: Object.keys(datosExtra).length > 0 ? datosExtra : null,
      nota: form.notas || null,
      fecha_inicio: new Date().toISOString(),
    });

    if (error) {
      toast.error("Error al registrar: " + error.message);
      setGuardando(false);
      return;
    }

    // Actualizar ultima_gestion en el cliente
    await supabase.from("clientes").update({
      ultima_gestion: new Date().toISOString(),
      proxima_accion: proximaFinal,
    }).eq("id", id);

    if (autoAgenda) {
      toast.success("Actividad registrada. Próxima visita agendada en 30 días ✅");
    } else {
      toast.success("Actividad registrada en la bitácora ✅");
    }
    setForm({ tipo: "visita", notas: "", proxima_accion: "" });
    setResultadoId(""); setResultadoReal("");
    setReceptorNombre(""); setReceptorApellido(""); setFechaEntrega(""); setActaNro("");
    setContactoNombre(""); setContactoApellido("");
    setContactoTelefono(""); setContactoEmail("");
    setContactoFecha(new Date().toISOString().split("T")[0]);
    setShowForm(false);
    await cargarGestiones();
    await cargarCliente();
    setGuardando(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!cliente) return null;

  const instancia = cliente.instancia ?? "CENSO";
  const instanciaColor = INSTANCIA_COLORS[instancia] ?? "bg-gray-500";

  return (
    <>
      {/* Header */}
      <header className="gradient-hero text-primary-foreground">
        <div className="px-4 pb-5 pt-4">
          <div className="flex items-center justify-between">
            <Link to="/app/clientes" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {(canManage || esPropio || esCreadorCenso) && (
              <Link
                to={`/app/clientes/${id}/editar`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide hover:bg-white/20 transition-smooth"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Link>
            )}
          </div>
          <div className="mt-3">
            {(cliente.categoria as any)?.nombre && (
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                {(cliente.categoria as any).nombre}
                {(cliente.rubro_rel as any)?.nombre && ` · ${(cliente.rubro_rel as any).nombre}`}
                {subRubroNombre && ` · ${subRubroNombre}`}
              </p>
            )}
            {cliente.numero_cliente && (
              <p className="mt-1 text-[11px] font-bold tracking-widest text-accent/80 uppercase">
                ID {String(cliente.numero_cliente).padStart(4, "0")}
              </p>
            )}
            <h1 className="text-xl font-bold leading-tight">{cliente.nombre_comercial}</h1>
            {cliente.razon_social && (
              <p className="mt-0.5 text-xs text-primary-foreground/70">{cliente.razon_social}</p>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className={cn("rounded-full px-3 py-1 text-[11px] font-bold uppercase text-white", instanciaColor)}>
              {instancia}
            </span>
            <span className={cn(
              "rounded-full px-3 py-1 text-[11px] font-bold uppercase",
              cliente.activo ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
            )}>
              {cliente.activo ? "Activo" : "Inactivo"}
            </span>
            {cliente.tipo_cliente && (
              <span className={cn(
                "rounded-full px-3 py-1 text-[11px] font-bold uppercase",
                cliente.tipo_cliente === "evento"
                  ? "bg-amber-400/30 text-amber-100"
                  : "bg-white/15 text-primary-foreground/80"
              )}>
                {cliente.tipo_cliente === "evento" ? "🎉 Evento" : "🏪 Local"}
              </span>
            )}
            {/* Lead Score — calculado de las gestiones cargadas */}
            {gestiones.length > 0 && gestiones.some(g => (g.datos_extra as any)?.score != null) && (() => {
              const total = gestiones.reduce((sum, g) => {
                const s = Number((g.datos_extra as any)?.score);
                return sum + (isNaN(s) ? 0 : s);
              }, 0);
              const info = getLeadScoreInfo(total);
              const cls = scoreHeaderClasses(info.category);
              return (
                <span className={cn("rounded-full px-3 py-1 text-[11px] font-bold uppercase", cls.bg, cls.text)}>
                  {info.emoji} {info.label} {total > 0 ? `+${total}` : total} pts
                </span>
              );
            })()}
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4 pt-4 pb-8">

        {/* Banner para ejecutivo creador: cliente en CENSO pendiente de asignación — solo locales */}
        {esCreadorCenso && cliente.tipo_cliente !== "evento" && (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-2 dark:bg-amber-950/30 dark:border-amber-700">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">⏳ Pendiente de asignación</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {!cliente?.tarifa_mensual
                ? "Este cliente no tiene tarifa cargada. Usá el botón Editar para agregarla — es obligatoria para que tu supervisor pueda asignarte el cliente."
                : "La tarifa está cargada ✅. Avisá a tu supervisor para que te asigne este cliente y puedas comenzar a gestionarlo."}
            </p>
          </section>
        )}

        {/* Datos del cliente */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Datos del local</h2>
            <button
              onClick={() => setShowDatosLocal((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted transition-colors"
            >
              {showDatosLocal
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>
          {showDatosLocal && <>
          {cliente.telefono && <InfoRow icon={<Phone className="h-4 w-4" />} label="Teléfono" value={cliente.telefono} />}
          {cliente.email_cliente && <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={cliente.email_cliente} />}
          {(cliente.direccion || cliente.ciudad) && (
            <InfoRow icon={<MapPin className="h-4 w-4" />} label="Dirección" value={[
              cliente.direccion,
              cliente.calle_secundaria,
              cliente.barrio,
              cliente.localidad,
              cliente.ciudad,
            ].filter(Boolean).join(", ")} />
          )}
          {cliente.ruc && <InfoRow icon={<FileText className="h-4 w-4" />} label="RUC" value={cliente.ruc} />}
          {/* Campos específicos de Evento */}
          {cliente.tipo_cliente === "evento" && cliente.nombre_salon && (
            <InfoRow icon={<Building2 className="h-4 w-4" />} label="Salón / Espacio" value={cliente.nombre_salon} />
          )}
{cliente.tipo_cliente === "evento" && cliente.capacidad && (
            <InfoRow icon={<User className="h-4 w-4" />} label="Capacidad" value={`${cliente.capacidad.toLocaleString("es-PY")} personas`} />
          )}
          {cliente.tarifa_mensual && (
            <InfoRow icon={<Building2 className="h-4 w-4" />} label="Tarifa mensual" value={formatPYG(cliente.tarifa_mensual)} valueClass="font-bold text-primary" />
          )}
          {cliente.fecha_vencimiento && (
            <InfoRow
              icon={<Clock className="h-4 w-4" />}
              label="Vencimiento licencia"
              value={new Date(cliente.fecha_vencimiento + "T00:00:00").toLocaleDateString("es-PY", { day: "2-digit", month: "long", year: "numeric" })}
              valueClass={
                new Date(cliente.fecha_vencimiento) < new Date()
                  ? "font-bold text-destructive"
                  : new Date(cliente.fecha_vencimiento) <= new Date(Date.now() + 7 * 86_400_000)
                  ? "font-bold text-warning"
                  : "font-semibold text-success"
              }
            />
          )}
          {cliente.notas && (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setShowRelevamiento((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Relevamiento de datos</p>
                  {showRelevamiento
                    ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </button>
                {showRelevamiento && (
                  <p className="mt-1.5 text-sm whitespace-pre-wrap text-foreground leading-relaxed">{cliente.notas}</p>
                )}
              </div>
            </div>
          )}
          {cliente.created_at && (
            <InfoRow
              icon={<Calendar className="h-4 w-4" />}
              label="Alta en sistema"
              value={new Date(cliente.created_at).toLocaleDateString("es-PY", { day: "2-digit", month: "long", year: "numeric" })}
            />
          )}
          </>}
        </section>

        {/* Asignación de ejecutivo — admin y supervisor, cuando el cliente no tiene ejecutivo asignado */}
        {canManage && !cliente.ejecutivo_id && (
          <section className="rounded-2xl border border-warning/40 bg-warning/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-warning" />
              <h2 className="text-sm font-bold text-warning">Asignar ejecutivo comercial</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Este cliente está en CENSO sin asignar. Al asignarlo pasará automáticamente a instancia <strong>COMERCIAL</strong>.
            </p>

            {/* Bloqueo si falta tarifa */}
            {!cliente.tarifa_mensual ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive font-semibold">
                ⚠️ Requerido: completá la Tarifa Mensual del cliente antes de poder asignarlo a un ejecutivo.
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={ejecutivoSeleccionado}
                  onChange={(e) => setEjecutivoSeleccionado(e.target.value)}
                  className="h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">Seleccioná un ejecutivo...</option>
                  {ejecutivos.map((e) => (
                    <option key={e.id} value={e.id}>
                      {[e.nombre, e.apellido].filter(Boolean).join(" ")}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={asignarEjecutivo}
                  disabled={asignando || !ejecutivoSeleccionado}
                  className="h-11 px-4 font-semibold"
                >
                  {asignando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Asignar"}
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Re-asignar ejecutivo — admin y supervisor pueden reasignar en cualquier momento */}
        {canManage && cliente.ejecutivo_id && (
          <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reasignar ejecutivo</h2>
            </div>
            <div className="flex gap-2">
              <select
                value={ejecutivoSeleccionado}
                onChange={(e) => setEjecutivoSeleccionado(e.target.value)}
                className="h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="">Seleccioná nuevo ejecutivo...</option>
                {ejecutivos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {[e.nombre, e.apellido].filter(Boolean).join(" ")}
                  </option>
                ))}
              </select>
              <Button
                onClick={asignarEjecutivo}
                disabled={asignando || !ejecutivoSeleccionado}
                variant="outline"
                className="h-11 px-4 font-semibold"
              >
                {asignando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reasignar"}
              </Button>
            </div>
          </section>
        )}

        {/* Registrar cobro — solo cuando está en COMERCIAL */}
        {(esPropio || canManage) && instancia === "COMERCIAL" && (
          <section>
            <Button
              onClick={() => {
                if (cliente.tipo_cliente === "evento") {
                  const next = !modoSeleccion;
                  setModoSeleccion(next);
                  if (!next) { setEventosSeleccionados(new Set()); setShowCobroEventos(false); }
                } else {
                  setShowCobro((v) => !v); setShowForm(false);
                }
              }}
              className={cn("w-full gap-2 text-base font-bold",
                (showCobro || modoSeleccion) ? "" : "bg-green-600 hover:bg-green-700 text-white border-0"
              )}
              variant={(showCobro || modoSeleccion) ? "outline" : "default"}
            >
              {(showCobro || modoSeleccion) ? <ChevronUp className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {(showCobro || modoSeleccion) ? "Cancelar cobro" : "💰 Registrar cobro"}
            </Button>

            {showCobro && cliente.tipo_cliente !== "evento" && (
              <div className="mt-3 rounded-2xl border border-success/30 bg-success/5 p-4 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-success">Datos del cobro</p>

                {/* Monto */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Monto cobrado (Gs.) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder={cliente.tarifa_mensual ? String(cliente.tarifa_mensual) : "500000"}
                    value={cobro.monto}
                    onChange={(e) => setCob("monto", e.target.value)}
                    className="h-11"
                  />
                  {cliente.tarifa_mensual && !cobro.monto && (
                    <button
                      type="button"
                      onClick={() => setCob("monto", String(cliente.tarifa_mensual))}
                      className="text-[11px] text-primary font-semibold hover:underline"
                    >
                      Usar tarifa mensual: {formatPYG(cliente.tarifa_mensual)}
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
                  onClick={registrarCobro}
                  disabled={guardandoCobro || !cobro.monto || !cobro.fecha_cobro}
                  className="w-full h-11 gap-2 font-semibold bg-green-600 hover:bg-green-700 text-white border-0"
                >
                  {guardandoCobro ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {guardandoCobro ? "Registrando..." : "Confirmar cobro"}
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Renovar licencia — disponible cuando el cliente está en COBRANZAS */}
        {(esPropio || canManage) && instancia === "COBRANZAS" && (
          <section>
            <Button
              onClick={renovarLicencia}
              disabled={renovando}
              variant="outline"
              className="w-full gap-2 border-primary/40 text-primary font-semibold hover:bg-primary/5 hover:border-primary"
            >
              {renovando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {renovando ? "Procesando..." : "🔄 Renovar licencia"}
            </Button>
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              El cliente vuelve a <strong>COMERCIAL</strong> para gestionar la renovación del período.
            </p>
          </section>
        )}

        {/* Enviar a JURÍDICO — disponible desde COMERCIAL o COBRANZAS */}
        {(esPropio || canManage) && (instancia === "COMERCIAL" || instancia === "COBRANZAS") && (
          <section>
            <Button
              onClick={() => { setShowJuridico((v) => !v); setShowRecuperar(false); }}
              variant={showJuridico ? "outline" : "ghost"}
              className={cn(
                "w-full gap-2 border font-semibold",
                showJuridico
                  ? "border-destructive/40 text-destructive hover:bg-destructive/5"
                  : "border-destructive/30 text-destructive hover:bg-destructive/5 hover:border-destructive/60"
              )}
            >
              {showJuridico ? <ChevronUp className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {showJuridico ? "Cancelar" : "⚠️ Enviar a Jurídico"}
            </Button>

            {showJuridico && (
              <div className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <p className="text-sm font-bold text-destructive">Enviar a Jurídico</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  El cliente pasará a instancia <strong>JURÍDICO</strong>. Esta acción queda registrada en el historial.
                  Indicá el motivo de la escalación.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Motivo <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    placeholder="Ej: Cliente no responde a gestiones repetidas, deuda acumulada de 3 meses..."
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <Button
                  onClick={escalarJuridico}
                  disabled={escalando || !motivo.trim()}
                  className="w-full h-11 gap-2 font-semibold bg-destructive hover:bg-destructive/90 text-white border-0"
                >
                  {escalando ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                  {escalando ? "Enviando..." : "Confirmar envío a Jurídico"}
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Recuperar desde JURÍDICO — volver a COMERCIAL */}
        {(esPropio || canManage) && instancia === "JURIDICO" && (
          <section>
            <Button
              onClick={() => setShowRecuperar((v) => !v)}
              variant="ghost"
              className={cn(
                "w-full gap-2 border font-semibold",
                showRecuperar
                  ? "border-primary/40 text-primary hover:bg-primary/5"
                  : "border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/60"
              )}
            >
              {showRecuperar ? <ChevronUp className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
              {showRecuperar ? "Cancelar" : "🔄 Recuperar cliente"}
            </Button>

            {showRecuperar && (
              <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-primary" />
                  <p className="text-sm font-bold text-primary">Recuperar desde Jurídico</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  El cliente volverá a instancia <strong>COMERCIAL</strong> para continuar la gestión normal.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Observación <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    placeholder="Ej: Cliente regularizó situación, acuerdo de pago firmado..."
                    value={motivoRecuperar}
                    onChange={(e) => setMotivoRecuperar(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <Button
                  onClick={recuperarCliente}
                  disabled={recuperando || !motivoRecuperar.trim()}
                  className="w-full h-11 gap-2 font-semibold"
                >
                  {recuperando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  {recuperando ? "Procesando..." : "Confirmar recuperación"}
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Registrar nueva actividad */}
        {esPropio && instancia === "CENSO" && cliente.tipo_cliente !== "evento" && (
          <section className="rounded-2xl border border-border bg-card p-4 text-center space-y-1">
            <p className="text-sm font-semibold text-muted-foreground">Sin gestión disponible</p>
            <p className="text-xs text-muted-foreground">
              Este cliente aún está en <strong>CENSO</strong>. Las gestiones se habilitan una vez que pase a <strong>COMERCIAL</strong>.
            </p>
          </section>
        )}

        {/* Sección de Eventos (solo para clientes tipo "evento") */}
        {cliente.tipo_cliente === "evento" && instancia !== "CENSO" && (
          <section className="space-y-3">
            {/* Encabezado con contador y botón + */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">
                🎉 Eventos
                <span className="ml-2 text-xs font-normal text-muted-foreground">({eventosAgenda.length})</span>
              </h2>
              {(esPropio || canManage) && !showFormEvento && !modoSeleccion && (
                <button
                  onClick={() => setShowFormEvento(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground active:scale-95 transition-smooth"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo evento
                </button>
              )}
              {modoSeleccion && (
                <span className="text-[11px] font-semibold text-green-700 dark:text-green-400">
                  Tocá los eventos a cobrar
                </span>
              )}
            </div>

            {/* Formulario inline de nuevo evento */}
            {showFormEvento && (
              <div className="rounded-2xl border-2 border-amber-400 bg-amber-50/60 dark:bg-amber-950/30 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Nuevo evento</p>
                  <button onClick={() => { setShowFormEvento(false); setFormEvento(eventoFormVacio); }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Nombre */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre del evento <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Casamiento García – López"
                    value={formEvento.nombre_evento}
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
                      value={formEvento.fecha_evento}
                      onChange={(e) => setEv("fecha_evento", e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo <span className="text-destructive">*</span></Label>
                    <select
                      value={formEvento.tipo_evento}
                      onChange={(e) => setEv("tipo_evento", e.target.value)}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Tipo...</option>
                      <option value="casamiento">Casamiento</option>
                      <option value="quinceanos">Quinceaños</option>
                      <option value="corporativo">Corporativo</option>
                      <option value="social">Social / Privado</option>
                      <option value="musical">Musical / Show</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                </div>

                {/* Tarifa */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Tarifa del evento (Gs.)</Label>
                  <Input
                    type="number"
                    placeholder="500000"
                    value={formEvento.tarifa_evento}
                    onChange={(e) => setEv("tarifa_evento", e.target.value)}
                    className="h-11"
                  />
                </div>

                {/* Notas */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Notas</Label>
                  <Textarea
                    placeholder="Observaciones..."
                    value={formEvento.notas}
                    onChange={(e) => setEv("notas", e.target.value)}
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>

                {/* Botones de acción */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => guardarEvento(true)}
                    disabled={guardandoEvento}
                    variant="outline"
                    className="flex-1 gap-1.5 border-amber-400 text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-xs h-10"
                  >
                    {guardandoEvento ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Guardar y agregar otro
                  </Button>
                  <Button
                    onClick={() => guardarEvento(false)}
                    disabled={guardandoEvento}
                    className="flex-1 gap-1.5 text-xs h-10"
                  >
                    {guardandoEvento ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Guardar y cerrar
                  </Button>
                </div>
              </div>
            )}

            {/* Lista de eventos */}
            {loadingEventos ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : eventosAgenda.length === 0 && !showFormEvento ? (
              <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/30 dark:bg-amber-950/10 p-8 text-center">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Sin eventos registrados</p>
                <p className="mt-1 text-xs text-muted-foreground">Tocá "Nuevo evento" para empezar la carga</p>
              </div>
            ) : (
              <>
              <div className="space-y-2">
                {eventosAgenda.map((ev) => {
                  const estadoColors: Record<string, string> = {
                    prospecto:  "bg-yellow-100 text-yellow-700",
                    confirmado: "bg-blue-100 text-blue-700",
                    cerrado:    "bg-green-100 text-green-700",
                    cancelado:  "bg-red-100 text-red-700",
                  };
                  const tipoLabel: Record<string, string> = {
                    casamiento: "Casamiento", quinceanos: "Quinceaños",
                    corporativo: "Corporativo", social: "Social", musical: "Musical", otro: "Otro",
                  };
                  const seleccionado = eventosSeleccionados.has(ev.id);
                  const cardContent = (
                    <div className="flex items-start gap-3">
                      {/* Checkbox en modo selección */}
                      {modoSeleccion && (
                        <div className={cn(
                          "mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
                          seleccionado
                            ? "border-green-600 bg-green-600"
                            : "border-muted-foreground bg-background"
                        )}>
                          {seleccionado && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold tracking-widest text-amber-600 uppercase mb-0.5">
                          EV-{String(ev.numero_evento).padStart(3, "0")}
                        </p>
                        <h3 className="truncate text-sm font-bold">{ev.nombre_evento ?? "Sin nombre"}</h3>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {ev.tipo_evento && (
                            <span className="text-xs text-muted-foreground">{tipoLabel[ev.tipo_evento] ?? ev.tipo_evento}</span>
                          )}
                          {ev.fecha_evento && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(ev.fecha_evento + "T00:00:00").toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold", estadoColors[ev.estado] ?? "bg-gray-100 text-gray-600")}>
                          {ev.estado.charAt(0).toUpperCase() + ev.estado.slice(1)}
                        </span>
                        {ev.tarifa_evento && (
                          <span className="text-xs font-bold text-primary">{formatPYG(ev.tarifa_evento)}</span>
                        )}
                      </div>
                    </div>
                  );

                  return modoSeleccion ? (
                    <div
                      key={ev.id}
                      onClick={() => toggleEventoSeleccionado(ev.id)}
                      className={cn(
                        "block rounded-2xl border p-4 shadow-card cursor-pointer transition-smooth active:scale-[0.99]",
                        seleccionado
                          ? "border-green-500 bg-green-50/60 dark:bg-green-950/30"
                          : "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-400"
                      )}
                    >
                      {cardContent}
                    </div>
                  ) : (
                    <Link
                      key={ev.id}
                      to={`/app/clientes/${id}/eventos/${ev.id}`}
                      className="block rounded-2xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-4 shadow-card hover:border-amber-400 transition-smooth active:scale-[0.99]"
                    >
                      {cardContent}
                    </Link>
                  );
                })}
              </div>

              {/* Barra de selección + form de cobro */}
              {modoSeleccion && !showCobroEventos && eventosSeleccionados.size > 0 && (
                <div className="rounded-2xl border-2 border-green-500 bg-green-50 dark:bg-green-950/30 p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-green-800 dark:text-green-300">
                      {eventosSeleccionados.size} evento{eventosSeleccionados.size !== 1 ? "s" : ""} seleccionado{eventosSeleccionados.size !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400">
                      Total: {formatPYG(eventosAgenda.filter((ev) => eventosSeleccionados.has(ev.id)).reduce((s, ev) => s + (ev.tarifa_evento ?? 0), 0))}
                    </p>
                  </div>
                  <Button
                    onClick={abrirCobroEventos}
                    className="gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0 text-sm font-bold shrink-0"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Cobrar →
                  </Button>
                </div>
              )}

              {/* Formulario de cobro de eventos */}
              {showCobroEventos && (
                <div className="rounded-2xl border-2 border-green-500 bg-green-50/60 dark:bg-green-950/30 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-green-700 dark:text-green-400">Registrar cobro de eventos</p>
                    <button onClick={() => setShowCobroEventos(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Resumen de eventos seleccionados */}
                  <div className="rounded-xl bg-white/60 dark:bg-black/20 border border-green-200 dark:border-green-800 p-3 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Eventos incluidos</p>
                    {eventosAgenda.filter((ev) => eventosSeleccionados.has(ev.id)).map((ev) => (
                      <div key={ev.id} className="flex items-center justify-between text-xs">
                        <span className="font-semibold">EV-{String(ev.numero_evento).padStart(3, "0")} · {ev.nombre_evento ?? "Sin nombre"}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">{ev.tarifa_evento ? formatPYG(ev.tarifa_evento) : "—"}</span>
                      </div>
                    ))}
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

                  {/* Modalidad */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Modalidad</Label>
                    <select
                      value={cobroEv.modalidad}
                      onChange={(e) => setCobEv("modalidad", e.target.value)}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="pago_unico">Pago único</option>
                      <option value="mensual">Mensual</option>
                      <option value="trimestral">Trimestral</option>
                      <option value="semestral">Semestral</option>
                      <option value="anual">Anual</option>
                    </select>
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
                    ✅ Al confirmar, el cliente pasará automáticamente a <strong>COBRANZAS</strong>.
                  </div>

                  <Button
                    onClick={registrarCobroEventos}
                    disabled={guardandoCobroEv || !cobroEv.monto || !cobroEv.fecha_cobro}
                    className="w-full h-11 gap-2 font-semibold bg-green-600 hover:bg-green-700 text-white border-0"
                  >
                    {guardandoCobroEv ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {guardandoCobroEv ? "Registrando..." : `Confirmar cobro de ${eventosSeleccionados.size} evento(s)`}
                  </Button>
                </div>
              )}
              </>
            )}
          </section>
        )}

        {esPropio && instancia !== "CENSO" && cliente.tipo_cliente !== "evento" && (
          <section>
            <Button
              onClick={() => {
                if (!showForm) {
                  // Pre-cargar datos del cliente al abrir el form
                  setContactoTelefono(cliente.telefono ?? "");
                  setContactoEmail(cliente.email_cliente ?? "");
                  setContactoFecha(new Date().toISOString().split("T")[0]);
                }
                setShowForm((v) => !v);
              }}
              className="w-full gap-2"
              variant={showForm ? "outline" : "default"}
            >
              {showForm ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? "Cancelar" : "Registrar actividad"}
            </Button>

            {showForm && (
              <div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
                {/* Tipo */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo de gestión</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {TIPOS_GESTION.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => {
                          setForm((p) => ({ ...p, tipo: t.key, proxima_accion: "" }));
                          // Resetear campos al cambiar canal
                          setResultadoId(""); setResultadoReal("");
                          setReceptorNombre(""); setReceptorApellido(""); setFechaEntrega(""); setActaNro("");
                          setContactoNombre(""); setContactoApellido("");
                          // Pre-cargar teléfono y email del cliente
                          setContactoTelefono(cliente?.telefono ?? "");
                          setContactoEmail(cliente?.email_cliente ?? "");
                          setContactoFecha(new Date().toISOString().split("T")[0]);
                        }}
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
                    onChange={(e) => handleResultadoChange(e.target.value)}
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
                      📄 {resultadoSeleccionado?.nombre ?? "Datos del receptor"}
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
                    onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
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
                        onChange={(e) => setForm((p) => ({ ...p, proxima_accion: e.target.value }))}
                        className="h-11 pl-10"
                      />
                    </div>
                  </div>
                )}

                <Button onClick={registrarActividad} disabled={guardando} className="w-full h-11 gap-2 font-semibold">
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {guardando ? "Guardando..." : "Guardar en bitácora"}
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Historial de cobros */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Historial de cobros</h2>
            {cobrosCliente.length > 0 && (
              <span className="text-[11px] font-semibold text-muted-foreground">
                {cobrosCliente.length} registro{cobrosCliente.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loadingCobros ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : cobrosCliente.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">Sin cobros registrados aún</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {cobrosCliente.map((c) => {
                const fecha = new Date(c.fecha_cobro + "T00:00:00");
                const METODO: Record<string, string> = {
                  efectivo: "💵 Efectivo",
                  transferencia: "🏦 Transferencia",
                  cheque: "📋 Cheque",
                  tarjeta: "💳 Tarjeta",
                };
                const MODALIDAD: Record<string, string> = {
                  mensual: "Mensual",
                  trimestral: "Trimestral",
                  semestral: "Semestral",
                  anual: "Anual",
                  pago_unico: "Pago único",
                  evento: "Evento",
                };
                return (
                  <div key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold tabular-nums text-primary">{formatPYG(c.monto)}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {fecha.toLocaleDateString("es-PY", { day: "2-digit", month: "long", year: "numeric" })}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <span className="block rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-bold text-success">
                          {MODALIDAD[c.modalidad ?? "mensual"] ?? c.modalidad}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {METODO[c.metodo_pago ?? "efectivo"] ?? c.metodo_pago}
                        </span>
                      </div>
                    </div>

                    {(c.periodo_desde || c.periodo_hasta) && (
                      <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Período: {c.periodo_desde ?? "—"} → {c.periodo_hasta ?? "—"}
                      </p>
                    )}

                    {/* Eventos cobrados */}
                    {c.eventos_ids && c.eventos_ids.length > 0 && (
                      <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-2.5 py-2 space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Eventos cobrados</p>
                        {eventosAgenda
                          .filter((ev) => c.eventos_ids!.includes(ev.id))
                          .map((ev) => (
                            <p key={ev.id} className="text-[11px] text-foreground">
                              EV-{String(ev.numero_evento).padStart(3, "0")} · {ev.nombre_evento ?? "Sin nombre"}
                            </p>
                          ))}
                        {/* Si los eventos no están cargados (cobros históricos) */}
                        {eventosAgenda.filter((ev) => c.eventos_ids!.includes(ev.id)).length === 0 && (
                          <p className="text-[11px] text-muted-foreground">{c.eventos_ids.length} evento(s)</p>
                        )}
                      </div>
                    )}

                    {/* Datos de facturación (si difiere del titular) */}
                    {(c.razon_social_factura || c.ruc_factura) && (
                      <div className="mt-2 rounded-lg bg-muted/50 px-2.5 py-2 space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Facturado a</p>
                        {c.razon_social_factura && <p className="text-[11px] text-foreground font-semibold">{c.razon_social_factura}</p>}
                        {c.ruc_factura && <p className="text-[11px] text-muted-foreground">RUC: {c.ruc_factura}</p>}
                      </div>
                    )}

                    {c.notas && (
                      <p className="mt-1.5 text-[11px] text-muted-foreground italic">"{c.notas}"</p>
                    )}

                    {c.registrado_por_nombre && (
                      <p className="mt-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" /> Registrado por {c.registrado_por_nombre}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Historial de instancias */}
        {historial.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-bold">Historial de etapas</h2>
            <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
              {/* Línea de origen — creación */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
                  <div className="h-2 w-2 rounded-full bg-gray-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">Alta en CENSO</p>
                  {cliente.created_at && (
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(cliente.created_at).toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
              {historial.map((h, i) => {
                const COLOR: Record<string, string> = {
                  COMERCIAL: "bg-blue-100 text-blue-700",
                  COBRANZAS: "bg-green-100 text-green-700",
                  JURIDICO: "bg-red-100 text-red-700",
                };
                const color = COLOR[h.instancia_nueva] ?? "bg-gray-100 text-gray-600";
                const quien = h.ejecutivo
                  ? `${(h.ejecutivo as any).nombre ?? ""} ${(h.ejecutivo as any).apellido ?? ""}`.trim()
                  : "—";
                return (
                  <div key={h.id} className={`flex items-center gap-3 px-4 py-3 ${i < historial.length - 1 ? "border-b border-border" : ""}`}>
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${color}`}>
                      →
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">
                        {h.instancia_anterior && <span className="text-muted-foreground">{h.instancia_anterior} → </span>}
                        <span className={`font-bold`}>{h.instancia_nueva}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(h.created_at).toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })}
                        {quien && ` · ${quien}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Bitácora — solo para locales permanentes */}
        {cliente.tipo_cliente !== "evento" && (
        <section>
          <h2 className="mb-3 text-sm font-bold">
            Bitácora de actividades
            <span className="ml-2 text-xs font-normal text-muted-foreground">({gestiones.length})</span>
          </h2>

          {gestiones.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <p className="text-sm font-semibold text-muted-foreground">Sin actividades registradas</p>
              <p className="mt-1 text-xs text-muted-foreground">Las visitas, llamadas y mails aparecerán acá</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {gestiones.map((g) => {
                const tipoInfo = TIPOS_GESTION.find((t) => t.key === g.tipo) ?? TIPOS_GESTION[0];
                const fecha = new Date(g.fecha_inicio ?? g.created_at);
                const ejecutorNombre = g.ejecutivo
                  ? `${(g.ejecutivo as any).nombre ?? ""} ${(g.ejecutivo as any).apellido ?? ""}`.trim()
                  : "—";
                const de = g.datos_extra as any;

                return (
                  <div key={g.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase", tipoInfo.color)}>
                        <tipoInfo.icon className="h-3 w-3" />
                        {tipoInfo.label}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {fecha.toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </div>

                    {g.nota && <p className="mt-2.5 text-sm">{g.nota}</p>}

                    {/* datos_extra: Medición de Incógnito */}
                    {de && (de.ancho || de.alto || de.fondo || de.material) && (
                      <div className="mt-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-primary">📐 Medición</p>
                        {(de.ancho || de.alto || de.fondo) && (
                          <p className="text-xs text-foreground">
                            {[de.ancho && `Ancho: ${de.ancho}`, de.alto && `Alto: ${de.alto}`, de.fondo && `Fondo: ${de.fondo}`].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {de.material && <p className="text-xs text-muted-foreground">Material: {de.material}</p>}
                        {de.observaciones && <p className="text-xs text-muted-foreground italic">{de.observaciones}</p>}
                      </div>
                    )}

                    {/* datos_extra: Receptor (visita con nota/reunión) */}
                    {de && de.receptor_nombre && (
                      <div className="mt-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-primary">📄 Receptor</p>
                        <p className="text-xs text-foreground">
                          {[de.receptor_nombre, de.receptor_apellido].filter(Boolean).join(" ")}
                        </p>
                        {de.fecha_entrega && (
                          <p className="text-xs text-muted-foreground">
                            Fecha: {new Date(de.fecha_entrega + "T00:00:00").toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        )}
                        {de.acta_nro && (
                          <p className="text-xs text-muted-foreground">Acta Nro.: {de.acta_nro as string}</p>
                        )}
                      </div>
                    )}

                    {/* datos_extra: Contacto (llamada / whatsapp) */}
                    {de && de.contacto_nombre && !de.contacto_email && (
                      <div className="mt-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          {g.tipo === "llamada" ? "📞 Contacto" : "💬 Contacto"}
                        </p>
                        <p className="text-xs text-foreground">
                          {[de.contacto_nombre, de.contacto_apellido].filter(Boolean).join(" ")}
                        </p>
                        {de.contacto_telefono && (
                          <p className="text-xs text-muted-foreground">Tel: {de.contacto_telefono as string}</p>
                        )}
                        {de.contacto_fecha && (
                          <p className="text-xs text-muted-foreground">
                            Fecha: {new Date(de.contacto_fecha + "T00:00:00").toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        )}
                      </div>
                    )}

                    {/* datos_extra: Email */}
                    {de && de.contacto_email && (
                      <div className="mt-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-primary">✉️ Destinatario</p>
                        <p className="text-xs text-foreground">
                          {[de.contacto_nombre, de.contacto_apellido].filter(Boolean).join(" ")}
                        </p>
                        <p className="text-xs text-muted-foreground">{de.contacto_email as string}</p>
                        {de.contacto_fecha && (
                          <p className="text-xs text-muted-foreground">
                            Fecha: {new Date(de.contacto_fecha + "T00:00:00").toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        )}
                      </div>
                    )}

                    {/* datos_extra: Resultado real */}
                    {de && de.resultado_real && (
                      <div className="mt-2.5 rounded-lg border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2 space-y-0.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">🎯 Resultado</p>
                        <p className="text-xs text-foreground font-semibold">
                          {RESULTADOS_GESTION.find((r) => r.key === de.resultado_real)?.label ?? (de.resultado_real as string)}
                        </p>
                      </div>
                    )}

                    {g.foto_url && (
                      <a href={g.foto_url} target="_blank" rel="noopener noreferrer" className="mt-2.5 block">
                        <img
                          src={g.foto_url}
                          alt="Evidencia de visita"
                          className="w-full rounded-xl object-cover border border-border"
                          style={{ maxHeight: 200 }}
                        />
                        <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Camera className="h-3 w-3" /> Ver foto completa
                        </span>
                      </a>
                    )}

                    <div className="mt-2.5 flex items-center justify-between text-[11px]">
                      {g.resultado && (
                        <span className="font-semibold">{g.resultado}</span>
                      )}
                      <span className="flex items-center gap-1 text-muted-foreground ml-auto">
                        <User className="h-3 w-3" /> {ejecutorNombre}
                      </span>
                    </div>

                    {(g as any).proxima_accion && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-[11px] text-warning">
                        <Calendar className="h-3 w-3" />
                        Próxima acción: {new Date((g as any).proxima_accion).toLocaleDateString("es-PY", { day: "2-digit", month: "short" })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}

      </div>
    </>
  );
};

const InfoRow = ({ icon, label, value, valueClass }: {
  icon: React.ReactNode; label: string; value: string; valueClass?: string;
}) => (
  <div className="flex items-start gap-3">
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("text-sm break-words", valueClass)}>{value}</p>
    </div>
  </div>
);

export default ClienteDetalle;