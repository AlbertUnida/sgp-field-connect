import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, MapPin, Phone, Building2, FileText, Calendar,
  Plus, Car, PhoneCall, Mail, CheckCircle2, Clock, Loader2,
  ChevronDown, ChevronUp, User, UserCheck, Pencil, MessageCircle,
  AlertTriangle, RotateCcw
} from "lucide-react";
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
  categoria: { nombre: string } | null;
  rubro_rel: { nombre: string } | null;
  sub_rubro_id: string | null;
  fecha_vencimiento: string | null;
  created_at: string | null;
}

interface Gestion {
  id: number;
  tipo: string;
  resultado: string | null;
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
}

interface HistorialInstancia {
  id: number;
  instancia_anterior: string | null;
  instancia_nueva: string;
  created_at: string;
  ejecutivo: { nombre: string; apellido: string } | null;
}

const TIPOS_GESTION = [
  { key: "visita",    label: "Visita",     icon: Car,       color: "bg-blue-100 text-blue-700" },
  { key: "llamada",   label: "Llamada",    icon: PhoneCall, color: "bg-green-100 text-green-700" },
  { key: "email",     label: "Email",      icon: Mail,      color: "bg-purple-100 text-purple-700" },
  { key: "whatsapp",  label: "WhatsApp",   icon: MessageCircle, color: "bg-emerald-100 text-emerald-700" },
  { key: "otro",      label: "Otro",       icon: FileText,      color: "bg-gray-100 text-gray-700" },
];

const RESULTADOS = [
  { key: "atendido",     label: "✅ Atendido" },
  { key: "comprometido", label: "🤝 Comprometido" },
  { key: "proxima_cita", label: "📅 Próxima cita" },
  { key: "no_atendido",  label: "📵 No atendido" },
  { key: "rechazo",      label: "❌ Rechazo" },
  { key: "pago",         label: "💰 Pagó" },
  { key: "sin_resultado",label: "➖ Sin resultado" },
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
    resultado: "",
    notas: "",
    proxima_accion: "",
  });

  const esPropio = cliente?.ejecutivo_id === user?.id;
  // Ejecutivo que creó el cliente mientras está en CENSO (puede editar para cargar tarifa)
  const esCreadorCenso = cliente?.creado_por === user?.id && cliente?.instancia === "CENSO";

  useEffect(() => {
    if (!id) return;
    cargarCliente();
    cargarGestiones();
    cargarHistorial();
    cargarCobros();
  }, [id]);

  useEffect(() => {
    if (!canManage) return;
    supabase
      .from("profiles")
      .select("id, nombre, apellido")
      .in("rol", ["ejecutivo", "supervisor"])
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setEjecutivos(data ?? []));
  }, [isAdmin]);

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
    setHistorial(data ?? []);
  };

  const cargarCobros = async () => {
    setLoadingCobros(true);
    const { data } = await supabase
      .from("cobros")
      .select(`
        id, monto, metodo_pago, modalidad, fecha_cobro,
        periodo_desde, periodo_hasta, notas,
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
        id, tipo, resultado, nota, fecha_inicio, created_at, foto_url,
        ejecutivo:ejecutivo_id(nombre, apellido)
      `)
      .eq("cliente_id", id)
      .order("created_at", { ascending: false });

    setGestiones(data ?? []);
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
    if (!form.resultado) { toast.error("Seleccioná un resultado"); return; }

    setGuardando(true);

    const { error } = await supabase.from("gestiones").insert({
      cliente_id: parseInt(id!),
      ejecutivo_id: user!.id,
      tipo: form.tipo,
      resultado: form.resultado,
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
      proxima_accion: form.proxima_accion || null,
    }).eq("id", id);

    toast.success("Actividad registrada en la bitácora");
    setForm({ tipo: "visita", resultado: "", notas: "", proxima_accion: "" });
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
            <h1 className="mt-1 text-xl font-bold leading-tight">{cliente.nombre_comercial}</h1>
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
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase text-primary-foreground/80">
                {cliente.tipo_cliente}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4 pt-4 pb-8">

        {/* Banner para ejecutivo creador: cliente en CENSO pendiente de asignación */}
        {esCreadorCenso && (
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
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Datos del local</h2>
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
          {cliente.created_at && (
            <InfoRow
              icon={<Calendar className="h-4 w-4" />}
              label="Alta en sistema"
              value={new Date(cliente.created_at).toLocaleDateString("es-PY", { day: "2-digit", month: "long", year: "numeric" })}
            />
          )}
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
              onClick={() => { setShowCobro((v) => !v); setShowForm(false); }}
              className={cn("w-full gap-2 text-base font-bold", showCobro ? "" : "bg-green-600 hover:bg-green-700 text-white border-0")}
              variant={showCobro ? "outline" : "default"}
            >
              {showCobro ? <ChevronUp className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {showCobro ? "Cancelar cobro" : "💰 Registrar cobro"}
            </Button>

            {showCobro && (
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
                      <option value="otro">Otro</option>
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
        {esPropio && instancia === "CENSO" && (
          <section className="rounded-2xl border border-border bg-card p-4 text-center space-y-1">
            <p className="text-sm font-semibold text-muted-foreground">Sin gestión disponible</p>
            <p className="text-xs text-muted-foreground">
              Este cliente aún está en <strong>CENSO</strong>. Las gestiones se habilitan una vez que pase a <strong>COMERCIAL</strong>.
            </p>
          </section>
        )}

        {esPropio && instancia !== "CENSO" && (
          <section>
            <Button
              onClick={() => setShowForm((v) => !v)}
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
                        onClick={() => setForm((p) => ({ ...p, tipo: t.key }))}
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

                {/* Resultado */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Resultado <span className="text-destructive">*</span></Label>
                  <select
                    value={form.resultado}
                    onChange={(e) => setForm((p) => ({ ...p, resultado: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="">¿Cómo fue la gestión?</option>
                    {RESULTADOS.map((r) => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                </div>

                {/* Notas */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notas</Label>
                  <Textarea
                    placeholder="Detalles de la gestión, observaciones, acuerdos..."
                    value={form.notas}
                    onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                {/* Próxima acción */}
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

        {/* Bitácora */}
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
                const resultadoInfo = RESULTADOS.find((r) => r.key === g.resultado);
                const fecha = new Date(g.fecha_inicio ?? g.created_at);
                const ejecutorNombre = g.ejecutivo
                  ? `${(g.ejecutivo as any).nombre ?? ""} ${(g.ejecutivo as any).apellido ?? ""}`.trim()
                  : "—";

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
                      {resultadoInfo && (
                        <span className="font-semibold">{resultadoInfo.label}</span>
                      )}
                      <span className="flex items-center gap-1 text-muted-foreground">
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
