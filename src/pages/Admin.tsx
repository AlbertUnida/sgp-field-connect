import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Users, Target, ChevronDown, ChevronUp, Save, Shield, UserCheck,
  Eye, Loader2, Plus, Building2, Trash2, Tag, MapPin, ChevronRight,
  Clock, Calendar, BarChart2, AlertTriangle, CalendarClock, ClipboardList, GripVertical, Pencil, Check, X, Wallet
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { useProfile, Profile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatPYG, parseMontoPYG } from "@/lib/format";
import { addBusinessHours } from "@/lib/utils-field";
import { CensoSection } from "@/components/admin/CensoSection";
import { CatalogoSection } from "@/components/admin/CatalogoSection";
import { EventosSection } from "@/components/admin/EventosSection";
import { ResultadosSection } from "@/components/admin/ResultadosSection";

interface EjecutivoConMeta extends Profile {
  meta_actual: number | null;
}

interface Categoria { id: string; nombre: string; }

interface Rubro {
  id: string;
  categoria_id: string;
  nombre: string;
  dias_visita: number | null;
  dias_vigencia: number | null;
}

interface SubRubro {
  id: string;
  rubro_id: string;
  nombre: string;
}

interface ClienteCenso {
  id: string;
  nombre_comercial: string;
  ciudad: string | null;
  tarifa_mensual: number | null;
  created_at: string;
}

const ROLES = [
  { value: "ejecutivo", label: "Ejecutivo", icon: UserCheck, color: "text-primary" },
  { value: "supervisor", label: "Supervisor", icon: Eye, color: "text-warning" },
  { value: "admin", label: "Admin", icon: Shield, color: "text-destructive" },
] as const;

const AREAS = [
  { value: "comercial", label: "Comercial", icon: Building2 },
  { value: "cobranzas", label: "Cobranzas", icon: Wallet },
  { value: "juridico", label: "Jurídico", icon: ClipboardList },
] as const;

const MES_ACTUAL = new Date().getMonth() + 1;
const ANIO_ACTUAL = new Date().getFullYear();
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const formatPYGLocal = (n: number) =>
  new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 }).format(n);

type Seccion = "ejecutivos" | "censo" | "catalogo" | "seguimiento" | "resultados" | "eventos";

interface RubroEvento { id: string; nombre: string; activo: boolean; }
interface TipoEvento  { id: string; nombre: string; activo: boolean; }

interface TipoResultado {
  id: string;
  nombre: string;
  tipo_formulario: string | null;
  activo: boolean;
  orden: number;
  tipo_cartera: string;   // 'ambos' | 'local' | 'evento'
}

interface SeguimientoEj {
  id: string;
  nombre: string;
  totalClientes: number;
  visitasVencidas: number;
  contactosVencidos: number;
  proximosVencimientos: number;
}

const Admin = () => {
  const { isAdmin, isSupervisor, canManage, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const [seccion, setSeccion] = useState<Seccion>("censo");

  // ── EJECUTIVOS ──
  const [ejecutivos, setEjecutivos] = useState<EjecutivoConMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [metas, setMetas] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [nombresEdit, setNombresEdit] = useState<Record<string, string>>({});
  const [apellidosEdit, setApellidosEdit] = useState<Record<string, string>>({});
  const [savingNombre, setSavingNombre] = useState<string | null>(null);
  const [showNuevoUser, setShowNuevoUser] = useState(false);
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoApellido, setNuevoApellido] = useState("");
  const [nuevoRol, setNuevoRol] = useState<"ejecutivo" | "supervisor" | "admin">("ejecutivo");
  const [nuevoArea, setNuevoArea] = useState<"comercial" | "cobranzas" | "juridico">("comercial");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [creandoUser, setCreandoUser] = useState(false);

  // ── CENSO (sin asignar) ──
  const [clientesCenso, setClientesCenso] = useState<ClienteCenso[]>([]);
  const [loadingCenso, setLoadingCenso] = useState(false);
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});
  const [asignando, setAsignando] = useState<string | null>(null);

  // ── CATÁLOGO ──


  // ── SEGUIMIENTO ──
  const [seguimientoData, setSeguimientoData] = useState<SeguimientoEj[]>([]);
  const [loadingSeguimiento, setLoadingSeguimiento] = useState(false);

  // ── RESULTADOS ──

  useEffect(() => {
    if (!profileLoading && !canManage) navigate("/app");
  }, [canManage, profileLoading, navigate]);

  useEffect(() => {
    if (!profileLoading && canManage) {
      // Admin abre en Equipo; supervisor en CENSO
      setSeccion(isAdmin ? "ejecutivos" : "censo");
      cargarEjecutivos();
    }
  }, [canManage, isAdmin, profileLoading]);

  useEffect(() => {
    if (seccion === "censo") cargarCenso();
    if (seccion === "seguimiento") cargarSeguimiento();
  }, [seccion]);

  // ─── EJECUTIVOS ───────────────────────────────────────
  const cargarEjecutivos = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*").order("nombre");
    const { data: metasData } = await supabase.from("metas").select("ejecutivo_id, monto_meta")
      .eq("mes", MES_ACTUAL).eq("anio", ANIO_ACTUAL);
    const metasMap: Record<string, number> = {};
    metasData?.forEach((m) => { metasMap[m.ejecutivo_id] = m.monto_meta; });
    const lista: EjecutivoConMeta[] = (profiles || []).map((p) => ({ ...p, meta_actual: metasMap[p.id] ?? null }));
    setEjecutivos(lista);
    const metasInit: Record<string, string> = {};
    const nombresInit: Record<string, string> = {};
    const apellidosInit: Record<string, string> = {};
    lista.forEach((e) => {
      metasInit[e.id] = e.meta_actual ? String(e.meta_actual) : "";
      nombresInit[e.id] = e.nombre ?? "";
      apellidosInit[e.id] = e.apellido ?? "";
    });
    setMetas(metasInit);
    setNombresEdit(nombresInit);
    setApellidosEdit(apellidosInit);
    setLoading(false);
  };

  const guardarMeta = async (ejecutivoId: string) => {
    const monto = parseMontoPYG(metas[ejecutivoId] ?? "") ?? 0;
    if (!monto || monto <= 0) { toast.error("Ingresá un monto válido"); return; }
    setSaving(ejecutivoId);
    const { error } = await supabase.from("metas").upsert(
      { ejecutivo_id: ejecutivoId, mes: MES_ACTUAL, anio: ANIO_ACTUAL, monto_meta: monto },
      { onConflict: "ejecutivo_id,mes,anio" }
    );
    if (error) toast.error("Error al guardar la meta");
    else { toast.success("Meta guardada"); await cargarEjecutivos(); }
    setSaving(null);
  };

  const guardarNombre = async (ejecutivoId: string) => {
    const nombre = nombresEdit[ejecutivoId]?.trim();
    if (!nombre) { toast.error("El nombre no puede estar vacío"); return; }
    setSavingNombre(ejecutivoId);
    const { error } = await supabase.from("profiles").update({
      nombre,
      apellido: apellidosEdit[ejecutivoId]?.trim() || null,
    }).eq("id", ejecutivoId);
    if (error) toast.error("Error al guardar: " + error.message);
    else { toast.success("Nombre actualizado ✅"); await cargarEjecutivos(); }
    setSavingNombre(null);
  };

  const cambiarRol = async (ejecutivoId: string, rol: string) => {
    const { error, count } = await supabase
      .from("profiles")
      .update({ rol }, { count: "exact" })
      .eq("id", ejecutivoId);

    if (error) {
      toast.error("Error al cambiar el rol: " + error.message);
    } else if (count === 0) {
      toast.error("Sin permisos para cambiar el rol. Ejecutá el SQL de políticas RLS en Supabase.");
    } else {
      toast.success("Rol actualizado ✅");
      await cargarEjecutivos();
    }
  };

  const cambiarArea = async (ejecutivoId: string, area: string) => {
    const { error, count } = await supabase
      .from("profiles")
      .update({ area }, { count: "exact" })
      .eq("id", ejecutivoId);
    if (error) {
      toast.error("Error al cambiar el área: " + error.message);
    } else if (count === 0) {
      toast.error("Sin permisos para cambiar el área.");
    } else {
      toast.success("Área actualizada ✅");
      await cargarEjecutivos();
    }
  };

  const crearUsuario = async () => {
    if (!nuevoEmail || !nuevaPassword || !nuevoNombre) { toast.error("Completá nombre, email y contraseña"); return; }
    if (nuevaPassword.length < 8) { toast.error("La contraseña debe tener al menos 8 caracteres"); return; }
    setCreandoUser(true);

    try {
      // C2: Usar Edge Function con service_role en lugar de signUp() público
      const { data, error } = await supabase.functions.invoke("crear-usuario", {
        body: {
          email: nuevoEmail.trim().toLowerCase(),
          password: nuevaPassword,
          nombre: nuevoNombre.trim(),
          apellido: nuevoApellido.trim() || null,
          rol: nuevoRol,
          area: nuevoArea,
        },
      });

      if (error) {
        toast.error("Error al crear usuario: " + error.message);
        setCreandoUser(false);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setCreandoUser(false);
        return;
      }

      if (data?.warning) {
        toast.warning(`Usuario creado pero el perfil no se configuró: ${data.warning}`);
      } else {
        toast.success(`✅ Usuario ${nuevoNombre} creado. Ya puede iniciar sesión con la contraseña asignada.`);
      }

      setNuevoEmail(""); setNuevoNombre(""); setNuevoApellido("");
      setNuevaPassword(""); setNuevoRol("ejecutivo"); setNuevoArea("comercial"); setShowNuevoUser(false);
      await cargarEjecutivos();

    } catch (err: any) {
      toast.error("Error inesperado: " + err.message);
    }

    setCreandoUser(false);
  };

  // ─── CENSO ────────────────────────────────────────────
  const cargarCenso = async () => {
    setLoadingCenso(true);
    const { data } = await supabase
      .from("clientes")
      .select("id, nombre_comercial, ciudad, tarifa_mensual, created_at")
      .eq("instancia", "CENSO")
      .is("ejecutivo_id", null)
      .eq("activo", true)
      .order("created_at", { ascending: false });
    setClientesCenso(data ?? []);
    setLoadingCenso(false);
  };

  const asignarDesdeAdmin = async (clienteId: string) => {
    const ejecutivoId = asignaciones[clienteId];
    if (!ejecutivoId) { toast.error("Seleccioná un ejecutivo"); return; }
    setAsignando(clienteId);

    // Consultar tarifa directamente en la BD para no depender de datos en caché
    const { data: clienteActual } = await supabase
      .from("clientes")
      .select("tarifa_mensual, nombre_comercial")
      .eq("id", clienteId)
      .single();

    if (!clienteActual?.tarifa_mensual) {
      toast.error("El cliente debe tener Tarifa Mensual antes de asignarlo");
      setAsignando(null);
      return;
    }
    const { error } = await supabase.from("clientes").update({
      ejecutivo_id: ejecutivoId, instancia: "COMERCIAL",
    }).eq("id", clienteId);
    if (error) { toast.error("Error: " + error.message); setAsignando(null); return; }
    await supabase.from("historial_instancias").insert({
      cliente_id: parseInt(clienteId),
      instancia_anterior: "CENSO", instancia_nueva: "COMERCIAL",
      ejecutivo_id: ejecutivoId, notas: "Asignado desde panel Admin",
    });
    toast.success("Cliente asignado y movido a COMERCIAL ✅");
    await cargarCenso();
    setAsignando(null);
  };

  // ─── CATÁLOGO ─────────────────────────────────────────

  // ─── SEGUIMIENTO ──────────────────────────────────────
  const cargarSeguimiento = async () => {
    setLoadingSeguimiento(true);
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    const en7Dias = new Date();
    en7Dias.setDate(en7Dias.getDate() + 7);
    const hoy = new Date();

    // Clientes activos no-CENSO con ejecutivo y rubro
    const { data: clientesData } = await supabase
      .from("clientes")
      .select("id, ejecutivo_id, fecha_vencimiento, rubro_rel:rubro_id(dias_visita)")
      .eq("activo", true)
      .not("instancia", "eq", "CENSO")
      .not("ejecutivo_id", "is", null);

    if (!clientesData || clientesData.length === 0) {
      setSeguimientoData([]);
      setLoadingSeguimiento(false);
      return;
    }

    // A4: JOIN en lugar de .in() — Admin ve todos los clientes, escala sin límite de URL
    const { data: gestiones } = await supabase
      .from("gestiones")
      .select("id, cliente_id, tipo, created_at, clientes!inner(instancia, activo)")
      .eq("clientes.activo", true)
      .not("clientes.instancia", "eq", "CENSO")
      .gte("created_at", hace30Dias.toISOString())
      .order("created_at", { ascending: true });

    const gArr = gestiones ?? [];

    // Calcular por ejecutivo
    const ejMap: Record<string, { visitasV: number; contactosV: number; proxVenc: number; total: number }> = {};

    for (const c of clientesData) {
      const ejId = c.ejecutivo_id as string;
      if (!ejMap[ejId]) ejMap[ejId] = { visitasV: 0, contactosV: 0, proxVenc: 0, total: 0 };
      ejMap[ejId].total++;

      const diasVisita = (c.rubro_rel as any)?.dias_visita ?? 7;

      // Visitas vencidas
      const visitas = gArr
        .filter((g) => g.cliente_id === c.id && g.tipo === "visita")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const diasDesde = visitas.length === 0
        ? 30
        : (hoy.getTime() - new Date(visitas[0].created_at).getTime()) / 86_400_000;
      if (diasDesde > diasVisita) ejMap[ejId].visitasV++;

      // Contactos vencidos (visita sin seguimiento 24h hábiles)
      const visitasRecientes = gArr.filter(
        (g) => g.cliente_id === c.id && g.tipo === "visita" &&
          hoy.getTime() - new Date(g.created_at).getTime() < 10 * 86_400_000
      );
      let tieneContactoVencido = false;
      for (const vis of visitasRecientes) {
        const vFecha = new Date(vis.created_at);
        const deadline = addBusinessHours(vFecha, 24);
        if (hoy > deadline) {
          const tieneContacto = gArr.some(
            (g) => g.cliente_id === c.id && g.tipo !== "visita" &&
              new Date(g.created_at) > vFecha && new Date(g.created_at) <= deadline
          );
          if (!tieneContacto) { tieneContactoVencido = true; break; }
        }
      }
      if (tieneContactoVencido) ejMap[ejId].contactosV++;

      // Próximos vencimientos (licencia vence en 7 días)
      if (c.fecha_vencimiento) {
        // M4: parsear como hora local para evitar bug de UTC (vence a las 21h del día anterior)
        const fv = new Date(c.fecha_vencimiento + "T00:00:00");
        if (fv >= hoy && fv <= en7Dias) ejMap[ejId].proxVenc++;
      }
    }

    // Cruzar con perfiles de ejecutivos
    const resultado: SeguimientoEj[] = ejecutivos
      .filter((e) => ejMap[e.id])
      .map((e) => ({
        id: e.id,
        nombre: [e.nombre, e.apellido].filter(Boolean).join(" ") || e.email,
        totalClientes: ejMap[e.id].total,
        visitasVencidas: ejMap[e.id].visitasV,
        contactosVencidos: ejMap[e.id].contactosV,
        proximosVencimientos: ejMap[e.id].proxVenc,
      }))
      .sort((a, b) => (b.visitasVencidas + b.contactosVencidos) - (a.visitasVencidas + a.contactosVencidos));

    setSeguimientoData(resultado);
    setLoadingSeguimiento(false);
  };

  if (profileLoading || loading) {
    return (
      <>
        <AppHeader title="Administración" subtitle="Cargando..." />
        <div className="flex justify-center pt-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </>
    );
  }

  const ejecutivosSolo = ejecutivos.filter((e) => e.rol === "ejecutivo" || e.rol === "supervisor");

  // ─── RESULTADOS ────────────────────────────────────────


  return (
    <>
      <AppHeader title="Administración" subtitle={`${MESES[MES_ACTUAL - 1]} ${ANIO_ACTUAL}`} />

      <div className="px-4 pt-5 pb-8 space-y-5">

        {/* Tabs — admins ven los 6; supervisores solo CENSO, Categ., Eventos, Seguimiento, Tareas */}
        <div className={cn(
          "gap-1 rounded-2xl border border-border bg-card p-1.5",
          isAdmin ? "grid grid-cols-6" : "grid grid-cols-5"
        )}>
          {([
            { key: "ejecutivos",  label: "Equipo",    icon: Users,          adminOnly: true },
            { key: "censo",       label: "CENSO",     icon: Building2,      adminOnly: false },
            { key: "catalogo",    label: "Categ.",    icon: Tag,            adminOnly: false },
            { key: "eventos",     label: "Eventos",   icon: Calendar,       adminOnly: false },
            { key: "seguimiento", label: "Seguim.",   icon: BarChart2,      adminOnly: false },
            { key: "resultados",  label: "Tareas",    icon: ClipboardList,  adminOnly: false },
          ] as const).filter((t) => !t.adminOnly || isAdmin).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSeccion(key)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-bold uppercase tracking-wide transition-smooth",
                seccion === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ══ EQUIPO ══ */}
        {seccion === "ejecutivos" && isAdmin && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-center gap-2 text-primary"><Users className="h-4 w-4" /><span className="text-xs font-bold uppercase">Usuarios</span></div>
                <p className="mt-2 text-2xl font-bold">{ejecutivos.length}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-center gap-2 text-success"><Target className="h-4 w-4" /><span className="text-xs font-bold uppercase">Con meta</span></div>
                <p className="mt-2 text-2xl font-bold">{ejecutivos.filter((e) => e.meta_actual).length}</p>
              </div>
            </div>

            <Button onClick={() => setShowNuevoUser((v) => !v)} className="w-full gap-2" variant={showNuevoUser ? "outline" : "default"}>
              <Plus className="h-4 w-4" />{showNuevoUser ? "Cancelar" : "Agregar usuario"}
            </Button>

            {showNuevoUser && (
              <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
                <h3 className="font-bold text-sm">Nuevo usuario</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nombre <span className="text-destructive">*</span></Label>
                    <Input placeholder="María" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Apellido</Label>
                    <Input placeholder="González" value={nuevoApellido} onChange={(e) => setNuevoApellido(e.target.value)} className="h-11" />
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Email <span className="text-destructive">*</span></Label><Input type="email" placeholder="ejecutivo@sgp.org.py" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} className="h-11" /></div>
                <div className="space-y-1.5"><Label>Contraseña inicial <span className="text-destructive">*</span></Label><Input type="password" placeholder="Mínimo 8 caracteres" value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} className="h-11" /></div>
                <div className="space-y-1.5">
                  <Label>Rol</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLES.map((r) => (
                      <button key={r.value} type="button" onClick={() => setNuevoRol(r.value)}
                        className={cn("rounded-xl border px-2 py-2 text-[11px] font-bold uppercase tracking-wide transition-smooth",
                          nuevoRol === r.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-muted-foreground")}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Área</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {AREAS.map((a) => (
                      <button key={a.value} type="button" onClick={() => setNuevoArea(a.value)}
                        className={cn("rounded-xl border px-2 py-2 text-[11px] font-bold uppercase tracking-wide transition-smooth",
                          nuevoArea === a.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-muted-foreground")}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={crearUsuario} disabled={creandoUser} className="w-full gap-2">
                  {creandoUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {creandoUser ? "Creando..." : "Crear usuario"}
                </Button>
              </div>
            )}

            <div>
              <h2 className="mb-3 text-sm font-bold">Equipo</h2>
              <div className="space-y-2.5">
                {ejecutivos.map((ej) => {
                  const isOpen = expanded === ej.id;
                  const rolInfo = ROLES.find((r) => r.value === ej.rol) ?? ROLES[0];
                  const RolIcon = rolInfo.icon;
                  return (
                    <div key={ej.id} className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
                      <button className="w-full flex items-center gap-3 p-4 text-left" onClick={() => setExpanded(isOpen ? null : ej.id)}>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                          {(ej.nombre || ej.email).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{[ej.nombre, ej.apellido].filter(Boolean).join(" ") || "Sin nombre"}</p>
                          <p className="text-xs text-muted-foreground truncate">{ej.email}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn("flex items-center gap-1 text-[10px] font-bold uppercase", rolInfo.color)}>
                            <RolIcon className="h-3 w-3" />{rolInfo.label}
                          </span>
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                            {AREAS.find((a) => a.value === ej.area)?.label ?? ej.area}
                          </span>
                          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="border-t border-border px-4 pb-4 space-y-4">
                          {/* Editar nombre y apellido */}
                          <div className="space-y-2 pt-4">
                            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nombre y Apellido</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                placeholder="Nombre"
                                value={nombresEdit[ej.id] ?? ""}
                                onChange={(e) => setNombresEdit((p) => ({ ...p, [ej.id]: e.target.value }))}
                                className="h-10 text-sm"
                              />
                              <Input
                                placeholder="Apellido"
                                value={apellidosEdit[ej.id] ?? ""}
                                onChange={(e) => setApellidosEdit((p) => ({ ...p, [ej.id]: e.target.value }))}
                                className="h-10 text-sm"
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => guardarNombre(ej.id)}
                              disabled={savingNombre === ej.id}
                              className="w-full h-9 gap-1.5"
                            >
                              {savingNombre === ej.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                              Guardar nombre
                            </Button>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Meta {MESES[MES_ACTUAL - 1]} (Gs.)</Label>
                            {ej.meta_actual && <p className="text-xs text-success font-semibold">Actual: {formatPYGLocal(ej.meta_actual)}</p>}
                            <div className="flex gap-2">
                              <Input type="number" placeholder="Ej: 25000000" value={metas[ej.id] || ""}
                                onChange={(e) => setMetas((prev) => ({ ...prev, [ej.id]: e.target.value }))} className="h-11 flex-1" />
                              <Button size="sm" onClick={() => guardarMeta(ej.id)} disabled={saving === ej.id} className="h-11 gap-1.5 px-4">
                                {saving === ej.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Guardar
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Rol</Label>
                            <div className="grid grid-cols-3 gap-2">
                              {ROLES.map((r) => (
                                <button key={r.value} type="button" onClick={() => cambiarRol(ej.id, r.value)}
                                  className={cn("rounded-xl border px-2 py-2 text-[11px] font-bold uppercase tracking-wide transition-smooth",
                                    ej.rol === r.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-muted-foreground hover:border-primary/40")}>
                                  {r.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Área</Label>
                            <div className="grid grid-cols-3 gap-2">
                              {AREAS.map((a) => (
                                <button key={a.value} type="button" onClick={() => cambiarArea(ej.id, a.value)}
                                  className={cn("rounded-xl border px-2 py-2 text-[11px] font-bold uppercase tracking-wide transition-smooth",
                                    ej.area === a.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary text-muted-foreground hover:border-primary/40")}>
                                  {a.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ══ CENSO ══ */}
        {seccion === "censo" && (
          <CensoSection
            clientes={clientesCenso}
            loading={loadingCenso}
            onActualizar={cargarCenso}
            asignaciones={asignaciones}
            onSelectEjecutivo={(cid, eid) => setAsignaciones((p) => ({ ...p, [cid]: eid }))}
            ejecutivos={ejecutivosSolo}
            onAsignar={asignarDesdeAdmin}
            asignando={asignando}
          />
        )}

        {/* ══ CATÁLOGO ══ */}
        {seccion === "catalogo" && (
          <CatalogoSection />
        )}
        {/* ══ SEGUIMIENTO ══ */}
        {seccion === "seguimiento" && (
          <>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="text-xs text-muted-foreground">
                Seguimiento en tiempo real de cada ejecutivo — visitas vencidas, contactos sin seguimiento y licencias por vencer en 7 días.
              </p>
            </div>

            {loadingSeguimiento ? (
              <div className="flex justify-center pt-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : seguimientoData.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <p className="text-sm font-semibold text-muted-foreground">Sin datos de ejecutivos</p>
                <p className="mt-1 text-xs text-muted-foreground">Los ejecutivos deben tener clientes activos asignados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {seguimientoData.map((ej) => {
                  const tieneAlertas = ej.visitasVencidas > 0 || ej.contactosVencidos > 0;
                  return (
                    <div key={ej.id} className={cn(
                      "rounded-2xl border bg-card shadow-card overflow-hidden",
                      tieneAlertas ? "border-destructive/30" : "border-border"
                    )}>
                      {/* Header ejecutivo */}
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                          {ej.nombre.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{ej.nombre}</p>
                          <p className="text-[11px] text-muted-foreground">{ej.totalClientes} clientes activos</p>
                        </div>
                        {tieneAlertas && (
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 divide-x divide-border">
                        <Link
                          to={`/app/alertas?tipo=visitas`}
                          className={cn(
                            "flex flex-col items-center py-3 gap-0.5 transition-smooth",
                            ej.visitasVencidas > 0 ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-secondary/60"
                          )}
                        >
                          <Clock className={cn("h-3.5 w-3.5", ej.visitasVencidas > 0 ? "text-destructive" : "text-muted-foreground")} />
                          <span className={cn("text-lg font-bold tabular-nums", ej.visitasVencidas > 0 ? "text-destructive" : "text-foreground")}>
                            {ej.visitasVencidas}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground text-center leading-tight">
                            Visitas{"\n"}vencidas
                          </span>
                        </Link>

                        <Link
                          to={`/app/alertas?tipo=contactos`}
                          className={cn(
                            "flex flex-col items-center py-3 gap-0.5 transition-smooth",
                            ej.contactosVencidos > 0 ? "bg-warning/5 hover:bg-warning/10" : "hover:bg-secondary/60"
                          )}
                        >
                          <AlertTriangle className={cn("h-3.5 w-3.5", ej.contactosVencidos > 0 ? "text-warning" : "text-muted-foreground")} />
                          <span className={cn("text-lg font-bold tabular-nums", ej.contactosVencidos > 0 ? "text-warning" : "text-foreground")}>
                            {ej.contactosVencidos}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground text-center leading-tight">
                            Contactos{"\n"}vencidos
                          </span>
                        </Link>

                        <Link
                          to={`/app/clientes?ej=${ej.id}`}
                          className="flex flex-col items-center py-3 gap-0.5 hover:bg-secondary/60 transition-smooth"
                        >
                          <CalendarClock className={cn("h-3.5 w-3.5", ej.proximosVencimientos > 0 ? "text-primary" : "text-muted-foreground")} />
                          <span className={cn("text-lg font-bold tabular-nums", ej.proximosVencimientos > 0 ? "text-primary" : "text-foreground")}>
                            {ej.proximosVencimientos}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground text-center leading-tight">
                            Vencen{"\n"}en 7 días
                          </span>
                        </Link>
                      </div>

                      {/* Ver cartera */}
                      <Link
                        to={`/app/clientes?ej=${ej.id}`}
                        className="flex items-center justify-between px-4 py-2.5 border-t border-border text-xs font-semibold text-primary hover:bg-secondary/40 transition-smooth"
                      >
                        <span>Ver cartera completa</span>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══ RESULTADOS ══ */}
        {seccion === "resultados" && (
          <ResultadosSection />
        )}

        {/* ──────────── EVENTOS ──────────── */}
        {seccion === "eventos" && (
          <EventosSection />
        )}

      </div>
    </>
  );
};

export default Admin;
