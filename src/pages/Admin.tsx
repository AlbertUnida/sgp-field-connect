import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Users, Target, ChevronDown, ChevronUp, Save, Shield, UserCheck,
  Eye, Loader2, Plus, Building2, Trash2, Tag, MapPin, ChevronRight,
  Clock, Calendar, BarChart2, AlertTriangle, CalendarClock, ClipboardList, GripVertical, Pencil, Check, X
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { useProfile, Profile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatPYG, parseMontoPYG } from "@/lib/mock-data";

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

function addBusinessHours(start: Date, hours: number): Date {
  const result = new Date(start);
  let remaining = hours;
  while (remaining > 0) {
    result.setTime(result.getTime() + 3_600_000);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return result;
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
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [creandoUser, setCreandoUser] = useState(false);

  // ── CENSO (sin asignar) ──
  const [clientesCenso, setClientesCenso] = useState<ClienteCenso[]>([]);
  const [loadingCenso, setLoadingCenso] = useState(false);
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});
  const [asignando, setAsignando] = useState<string | null>(null);

  // ── CATÁLOGO ──
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [subRubros, setSubRubros] = useState<SubRubro[]>([]);
  const [loadingCat, setLoadingCat] = useState(false);
  const [catExpandida, setCatExpandida] = useState<string | null>(null);
  const [rubroExpandido, setRubroExpandido] = useState<string | null>(null);
  const [nuevaCat, setNuevaCat] = useState("");
  const [guardandoCat, setGuardandoCat] = useState(false);
  const [nuevoRubroNombre, setNuevoRubroNombre] = useState<Record<string, string>>({});
  const [guardandoRubro, setGuardandoRubro] = useState<string | null>(null);
  const [nuevoSubRubroNombre, setNuevoSubRubroNombre] = useState<Record<string, string>>({});
  const [guardandoSubRubro, setGuardandoSubRubro] = useState<string | null>(null);
  const [diasVisitaEdit, setDiasVisitaEdit] = useState<Record<string, string>>({});
  const [diasVigenciaEdit, setDiasVigenciaEdit] = useState<Record<string, string>>({});
  const [guardandoDias, setGuardandoDias] = useState<string | null>(null);

  // ── CATÁLOGO EVENTOS ──
  const [rubrosEvento, setRubrosEvento] = useState<RubroEvento[]>([]);
  const [tiposEvento, setTiposEvento] = useState<TipoEvento[]>([]);
  const [loadingEventosCat, setLoadingEventosCat] = useState(false);
  const [nuevoRubroEvento, setNuevoRubroEvento] = useState("");
  const [guardandoRubroEvento, setGuardandoRubroEvento] = useState(false);
  const [nuevoTipoEvento, setNuevoTipoEvento] = useState("");
  const [guardandoTipoEvento, setGuardandoTipoEvento] = useState(false);

  // ── SEGUIMIENTO ──
  const [seguimientoData, setSeguimientoData] = useState<SeguimientoEj[]>([]);
  const [loadingSeguimiento, setLoadingSeguimiento] = useState(false);

  // ── RESULTADOS ──
  const [tiposResultado, setTiposResultado] = useState<TipoResultado[]>([]);
  const [loadingResultados, setLoadingResultados] = useState(false);
  const [nuevoResultadoNombre, setNuevoResultadoNombre] = useState("");
  const [guardandoResultado, setGuardandoResultado] = useState(false);
  const [editandoResultado, setEditandoResultado] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");

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
    if (seccion === "catalogo") cargarCatalogo();
    if (seccion === "seguimiento") cargarSeguimiento();
    if (seccion === "resultados") cargarResultados();
    if (seccion === "eventos") cargarCatalogoEventos();
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
      setNuevaPassword(""); setNuevoRol("ejecutivo"); setShowNuevoUser(false);
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
  const cargarCatalogo = async () => {
    setLoadingCat(true);
    const [{ data: cats }, { data: rubs }, { data: subRubs }] = await Promise.all([
      supabase.from("categorias").select("*").order("nombre"),
      supabase.from("rubros").select("id, categoria_id, nombre, dias_visita, dias_vigencia").order("nombre"),
      supabase.from("sub_rubros").select("id, rubro_id, nombre").order("nombre"),
    ]);
    setCategorias(cats ?? []);
    setRubros(rubs ?? []);
    setSubRubros(subRubs ?? []);
    // Inicializar estados de edición de días
    const dv: Record<string, string> = {};
    const dvg: Record<string, string> = {};
    (rubs ?? []).forEach((r) => {
      dv[r.id] = r.dias_visita != null ? String(r.dias_visita) : "7";
      dvg[r.id] = r.dias_vigencia != null ? String(r.dias_vigencia) : "30";
    });
    setDiasVisitaEdit(dv);
    setDiasVigenciaEdit(dvg);
    setLoadingCat(false);
  };

  const agregarCategoria = async () => {
    if (!nuevaCat.trim()) { toast.error("Escribí el nombre de la categoría"); return; }
    setGuardandoCat(true);
    const { error } = await supabase.from("categorias").insert({ nombre: nuevaCat.trim() });
    if (error) toast.error("Error: " + error.message);
    else { toast.success("Categoría creada"); setNuevaCat(""); await cargarCatalogo(); }
    setGuardandoCat(false);
  };

  const eliminarCategoria = async (id: string) => {
    const tieneRubros = rubros.some((r) => r.categoria_id === id);
    if (tieneRubros) { toast.error("Eliminá primero los rubros de esta categoría"); return; }
    const { error } = await supabase.from("categorias").delete().eq("id", id);
    if (error) toast.error("Error: " + error.message);
    else { toast.success("Categoría eliminada"); await cargarCatalogo(); }
  };

  const agregarRubro = async (categoriaId: string) => {
    const nombre = nuevoRubroNombre[categoriaId]?.trim();
    if (!nombre) { toast.error("Escribí el nombre del rubro"); return; }
    setGuardandoRubro(categoriaId);
    const { error } = await supabase.from("rubros").insert({
      nombre, categoria_id: categoriaId, dias_visita: 7, dias_vigencia: 30,
    });
    if (error) toast.error("Error: " + error.message);
    else {
      toast.success("Rubro agregado");
      setNuevoRubroNombre((p) => ({ ...p, [categoriaId]: "" }));
      await cargarCatalogo();
    }
    setGuardandoRubro(null);
  };

  const eliminarRubro = async (id: string) => {
    const tieneSubRubros = subRubros.some((s) => s.rubro_id === id);
    if (tieneSubRubros) { toast.error("Eliminá primero los sub rubros de este rubro"); return; }
    const { error } = await supabase.from("rubros").delete().eq("id", id);
    if (error) toast.error("Error: " + error.message);
    else { toast.success("Rubro eliminado"); await cargarCatalogo(); }
  };

  const guardarDiasRubro = async (rubroId: string) => {
    const diasVisita = parseInt(diasVisitaEdit[rubroId] || "7");
    const diasVigencia = parseInt(diasVigenciaEdit[rubroId] || "30");
    if (!diasVisita || diasVisita < 1) { toast.error("Días de visita debe ser al menos 1"); return; }
    if (!diasVigencia || diasVigencia < 1) { toast.error("Días de vigencia debe ser al menos 1"); return; }
    setGuardandoDias(rubroId);
    const { error } = await supabase.from("rubros").update({
      dias_visita: diasVisita, dias_vigencia: diasVigencia,
    }).eq("id", rubroId);
    if (error) toast.error("Error: " + error.message);
    else { toast.success("Configuración guardada ✅"); await cargarCatalogo(); }
    setGuardandoDias(null);
  };

  const agregarSubRubro = async (rubroId: string) => {
    const nombre = nuevoSubRubroNombre[rubroId]?.trim();
    if (!nombre) { toast.error("Escribí el nombre del sub rubro"); return; }
    setGuardandoSubRubro(rubroId);
    const { error } = await supabase.from("sub_rubros").insert({ nombre, rubro_id: rubroId });
    if (error) toast.error("Error: " + error.message);
    else {
      toast.success("Sub Rubro agregado");
      setNuevoSubRubroNombre((p) => ({ ...p, [rubroId]: "" }));
      await cargarCatalogo();
    }
    setGuardandoSubRubro(null);
  };

  const eliminarSubRubro = async (id: string) => {
    const { error } = await supabase.from("sub_rubros").delete().eq("id", id);
    if (error) toast.error("Error: " + error.message);
    else { toast.success("Sub Rubro eliminado"); await cargarCatalogo(); }
  };

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

    const ids = clientesData.map((c) => c.id);

    // Gestiones recientes (30 días) para calcular alertas
    const { data: gestiones } = await supabase
      .from("gestiones")
      .select("id, cliente_id, tipo, created_at")
      .in("cliente_id", ids)
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
  const cargarResultados = async () => {
    setLoadingResultados(true);
    const { data } = await supabase.from("tipos_resultado").select("*").order("orden").order("nombre");
    setTiposResultado(data ?? []);
    setLoadingResultados(false);
  };

  const agregarResultado = async () => {
    if (!nuevoResultadoNombre.trim()) return;
    setGuardandoResultado(true);
    const maxOrden = tiposResultado.reduce((m, t) => Math.max(m, t.orden), 0);
    const { error } = await supabase.from("tipos_resultado")
      .insert({ nombre: nuevoResultadoNombre.trim(), orden: maxOrden + 1 });
    if (error) { toast.error("Error: " + error.message); }
    else { toast.success("Resultado agregado ✅"); setNuevoResultadoNombre(""); cargarResultados(); }
    setGuardandoResultado(false);
  };

  const guardarEdicion = async (id: string) => {
    if (!editNombre.trim()) return;
    const { error } = await supabase.from("tipos_resultado")
      .update({ nombre: editNombre.trim() }).eq("id", id);
    if (error) { toast.error("Error: " + error.message); }
    else { toast.success("Actualizado ✅"); setEditandoResultado(null); cargarResultados(); }
  };

  const toggleActivo = async (t: TipoResultado) => {
    const { error } = await supabase.from("tipos_resultado")
      .update({ activo: !t.activo }).eq("id", t.id);
    if (!error) cargarResultados();
  };

  const actualizarCartera = async (id: string, valor: string) => {
    const { error } = await supabase.from("tipos_resultado")
      .update({ tipo_cartera: valor }).eq("id", id);
    if (error) { toast.error("Error: " + error.message); }
    else { cargarResultados(); }
  };

  // ─── CATÁLOGO EVENTOS ──────────────────────────────────
  const cargarCatalogoEventos = async () => {
    setLoadingEventosCat(true);
    const [{ data: re }, { data: te }] = await Promise.all([
      supabase.from("rubros_evento").select("*").order("nombre"),
      supabase.from("tipos_evento").select("*").order("nombre"),
    ]);
    setRubrosEvento(re ?? []);
    setTiposEvento(te ?? []);
    setLoadingEventosCat(false);
  };

  const agregarRubroEvento = async () => {
    const nombre = nuevoRubroEvento.trim();
    if (!nombre) { toast.error("Escribí el nombre del rubro"); return; }
    setGuardandoRubroEvento(true);
    const { error } = await supabase.from("rubros_evento").insert({ nombre });
    if (error) toast.error(error.message);
    else { toast.success("Rubro de evento agregado"); setNuevoRubroEvento(""); cargarCatalogoEventos(); }
    setGuardandoRubroEvento(false);
  };

  const toggleRubroEvento = async (id: string, activo: boolean) => {
    await supabase.from("rubros_evento").update({ activo: !activo }).eq("id", id);
    cargarCatalogoEventos();
  };

  const eliminarRubroEvento = async (id: string) => {
    const { error } = await supabase.from("rubros_evento").delete().eq("id", id);
    if (error) toast.error("No se puede eliminar: " + error.message);
    else { toast.success("Rubro eliminado"); cargarCatalogoEventos(); }
  };

  const agregarTipoEvento = async () => {
    const nombre = nuevoTipoEvento.trim();
    if (!nombre) { toast.error("Escribí el nombre del tipo"); return; }
    setGuardandoTipoEvento(true);
    const { error } = await supabase.from("tipos_evento").insert({ nombre });
    if (error) toast.error(error.message);
    else { toast.success("Tipo de evento agregado"); setNuevoTipoEvento(""); cargarCatalogoEventos(); }
    setGuardandoTipoEvento(false);
  };

  const toggleTipoEvento = async (id: string, activo: boolean) => {
    await supabase.from("tipos_evento").update({ activo: !activo }).eq("id", id);
    cargarCatalogoEventos();
  };

  const eliminarTipoEvento = async (id: string) => {
    const { error } = await supabase.from("tipos_evento").delete().eq("id", id);
    if (error) toast.error("No se puede eliminar: " + error.message);
    else { toast.success("Tipo eliminado"); cargarCatalogoEventos(); }
  };

  const CARTERA_OPTIONS: { value: string; label: string; color: string }[] = [
    { value: "ambos",  label: "Ambas",  color: "bg-secondary text-foreground border-border" },
    { value: "local",  label: "Local",  color: "bg-primary/10 text-primary border-primary/30" },
    { value: "evento", label: "Evento", color: "bg-accent/10 text-accent-foreground border-accent/40" },
  ];

  const FORMULARIO_LABEL: Record<string, string> = {
    medicion_incognito: "📐 Medición de Incógnito",
    sin_medios:         "🔇 Sin Medios",
    nota_comercial:     "📄 Nota Info & Prop. Com.",
  };

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
                <Button onClick={crearUsuario} disabled={creandoUser} className="w-full gap-2">
                  {creandoUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {creandoUser ? "Creando..." : "Crear usuario"}
                </Button>
              </div>
            )}

            <div>
              <h2 className="mb-3 text-sm font-bold">Equipo comercial</h2>
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
          <>
            <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4 text-sm text-warning font-semibold">
              ⏳ Clientes sin ejecutivo asignado — requieren asignación para pasar a COMERCIAL
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{clientesCenso.length} pendientes</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={cargarCenso}
                  disabled={loadingCenso}
                  className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-smooth"
                >
                  <svg className={cn("h-3.5 w-3.5", loadingCenso && "animate-spin")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
                  </svg>
                  Actualizar
                </button>
                <Link to="/app/nuevo-cliente" className="text-xs font-semibold text-primary">+ Nuevo cliente</Link>
              </div>
            </div>

            {loadingCenso ? (
              <div className="flex justify-center pt-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : clientesCenso.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <p className="text-sm font-semibold text-muted-foreground">Sin clientes pendientes ✅</p>
                <p className="mt-1 text-xs text-muted-foreground">Todos los clientes tienen ejecutivo asignado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clientesCenso.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm truncate">{c.nombre_comercial}</p>
                        {c.ciudad && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />{c.ciudad}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {c.tarifa_mensual ? (
                          <p className="text-sm font-bold text-primary">{formatPYG(c.tarifa_mensual)}</p>
                        ) : (
                          <p className="text-[11px] text-destructive font-semibold">Sin tarifa</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(c.created_at).toLocaleDateString("es-PY", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                    </div>

                    {!c.tarifa_mensual && (
                      <p className="text-[11px] text-destructive">⚠️ Cargá la tarifa antes de asignar</p>
                    )}

                    <div className="flex gap-2">
                      <select
                        value={asignaciones[c.id] ?? ""}
                        onChange={(e) => setAsignaciones((p) => ({ ...p, [c.id]: e.target.value }))}
                        disabled={!c.tarifa_mensual}
                        className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-40"
                      >
                        <option value="">Seleccioná ejecutivo...</option>
                        {ejecutivosSolo.map((e) => (
                          <option key={e.id} value={e.id}>
                            {[e.nombre, e.apellido].filter(Boolean).join(" ") || e.email}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        onClick={() => asignarDesdeAdmin(c.id)}
                        disabled={!asignaciones[c.id] || asignando === c.id || !c.tarifa_mensual}
                        className="h-10 px-3 shrink-0"
                      >
                        {asignando === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Asignar"}
                      </Button>
                      <Link to={`/app/clientes/${c.id}/editar`} className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-secondary px-3 text-sm font-semibold hover:border-primary/40 transition-smooth">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ CATÁLOGO ══ */}
        {seccion === "catalogo" && (
          <>
            {loadingCat ? (
              <div className="flex justify-center pt-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                {/* Nueva categoría */}
                <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nueva categoría</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ej: Gastronomía, Eventos, Entretenimiento..."
                      value={nuevaCat}
                      onChange={(e) => setNuevaCat(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && agregarCategoria()}
                      className="h-11 flex-1"
                    />
                    <Button onClick={agregarCategoria} disabled={guardandoCat} className="h-11 px-4">
                      {guardandoCat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Lista de categorías */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold">Categorías ({categorias.length})</h2>
                  </div>

                  {categorias.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                      <p className="text-sm text-muted-foreground">Sin categorías — agregá una arriba</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {categorias.map((cat) => {
                        const rubrosDeCat = rubros.filter((r) => r.categoria_id === cat.id);
                        const isOpen = catExpandida === cat.id;
                        return (
                          <div key={cat.id} className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
                            {/* Header categoría */}
                            <div className="flex items-center gap-3 p-4">
                              <button
                                className="flex-1 flex items-center gap-2 text-left"
                                onClick={() => setCatExpandida(isOpen ? null : cat.id)}
                              >
                                <Tag className="h-4 w-4 text-primary shrink-0" />
                                <span className="font-bold text-sm">{cat.nombre}</span>
                                <span className="text-[11px] text-muted-foreground ml-1">({rubrosDeCat.length} rubros)</span>
                                {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />}
                              </button>
                              <button
                                onClick={() => eliminarCategoria(cat.id)}
                                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {isOpen && (
                              <div className="border-t border-border px-4 pb-4 space-y-2 pt-3">
                                {/* Rubros */}
                                {rubrosDeCat.length === 0 ? (
                                  <p className="text-xs text-muted-foreground py-1">Sin rubros — agregá uno abajo</p>
                                ) : (
                                  rubrosDeCat.map((r) => {
                                    const subsDe = subRubros.filter((s) => s.rubro_id === r.id);
                                    const isRubroOpen = rubroExpandido === r.id;
                                    return (
                                      <div key={r.id} className="rounded-xl border border-border overflow-hidden">
                                        {/* Header rubro */}
                                        <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary/50">
                                          <button
                                            className="flex-1 flex items-center gap-2 text-left"
                                            onClick={() => setRubroExpandido(isRubroOpen ? null : r.id)}
                                          >
                                            <span className="text-sm font-semibold">{r.nombre}</span>
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                              <Clock className="h-3 w-3" />{r.dias_visita ?? 7}d visita
                                            </span>
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                              <Calendar className="h-3 w-3" />{r.dias_vigencia ?? 30}d licencia
                                            </span>
                                            {subsDe.length > 0 && (
                                              <span className="text-[10px] text-primary font-semibold">{subsDe.length} sub</span>
                                            )}
                                            {isRubroOpen
                                              ? <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" />
                                              : <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />}
                                          </button>
                                          <button
                                            onClick={() => eliminarRubro(r.id)}
                                            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>

                                        {/* Panel expandido del rubro */}
                                        {isRubroOpen && (
                                          <div className="border-t border-border p-3 space-y-3 bg-card">
                                            {/* Configuración de días */}
                                            <div className="rounded-xl bg-secondary/60 p-3 space-y-3">
                                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Configuración de plazos</p>
                                              <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                  <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                    <Clock className="h-3 w-3" /> Días entre visitas
                                                  </Label>
                                                  <Input
                                                    type="number"
                                                    min="1"
                                                    value={diasVisitaEdit[r.id] ?? "7"}
                                                    onChange={(e) => setDiasVisitaEdit((p) => ({ ...p, [r.id]: e.target.value }))}
                                                    className="h-9 text-sm"
                                                    placeholder="7"
                                                  />
                                                </div>
                                                <div className="space-y-1">
                                                  <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" /> Días de vigencia
                                                  </Label>
                                                  <Input
                                                    type="number"
                                                    min="1"
                                                    value={diasVigenciaEdit[r.id] ?? "30"}
                                                    onChange={(e) => setDiasVigenciaEdit((p) => ({ ...p, [r.id]: e.target.value }))}
                                                    className="h-9 text-sm"
                                                    placeholder="30"
                                                  />
                                                </div>
                                              </div>
                                              <Button
                                                size="sm"
                                                onClick={() => guardarDiasRubro(r.id)}
                                                disabled={guardandoDias === r.id}
                                                className="h-9 w-full gap-1.5"
                                              >
                                                {guardandoDias === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                                Guardar plazos
                                              </Button>
                                            </div>

                                            {/* Sub Rubros */}
                                            <div className="space-y-2">
                                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Sub Rubros ({subsDe.length})
                                              </p>
                                              {subsDe.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">Sin sub rubros aún</p>
                                              ) : (
                                                subsDe.map((s) => (
                                                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
                                                    <span className="text-xs font-medium">{s.nombre}</span>
                                                    <button
                                                      onClick={() => eliminarSubRubro(s.id)}
                                                      className="text-muted-foreground hover:text-destructive transition-smooth"
                                                    >
                                                      <Trash2 className="h-3 w-3" />
                                                    </button>
                                                  </div>
                                                ))
                                              )}
                                              {/* Agregar sub rubro */}
                                              <div className="flex gap-2 pt-1">
                                                <Input
                                                  placeholder="Nuevo sub rubro..."
                                                  value={nuevoSubRubroNombre[r.id] ?? ""}
                                                  onChange={(e) => setNuevoSubRubroNombre((p) => ({ ...p, [r.id]: e.target.value }))}
                                                  onKeyDown={(e) => e.key === "Enter" && agregarSubRubro(r.id)}
                                                  className="h-9 flex-1 text-sm"
                                                />
                                                <Button
                                                  size="sm"
                                                  onClick={() => agregarSubRubro(r.id)}
                                                  disabled={guardandoSubRubro === r.id}
                                                  className="h-9 px-3"
                                                >
                                                  {guardandoSubRubro === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                                )}

                                {/* Agregar rubro */}
                                <div className="flex gap-2 pt-1">
                                  <Input
                                    placeholder="Nuevo rubro... (Enter para guardar)"
                                    value={nuevoRubroNombre[cat.id] ?? ""}
                                    onChange={(e) => setNuevoRubroNombre((p) => ({ ...p, [cat.id]: e.target.value }))}
                                    onKeyDown={(e) => e.key === "Enter" && agregarRubro(cat.id)}
                                    className="h-10 flex-1 text-sm"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => agregarRubro(cat.id)}
                                    disabled={guardandoRubro === cat.id}
                                    className="h-10 px-3"
                                  >
                                    {guardandoRubro === cat.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
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
          <>
            <div className="rounded-2xl border border-border bg-primary/5 p-4 space-y-1">
              <p className="text-sm font-bold">Tipos de Tarea</p>
              <p className="text-xs text-muted-foreground">
                Configurá las tareas disponibles al registrar una gestión. Las que tienen formulario especial (📄) activan campos adicionales (receptor, fecha, acta).
              </p>
            </div>

            {/* Agregar nuevo */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nueva tarea</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Ej: Interesado, Sin respuesta, Pagó..."
                  value={nuevoResultadoNombre}
                  onChange={(e) => setNuevoResultadoNombre(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && agregarResultado()}
                  className="h-11 flex-1"
                />
                <Button
                  onClick={agregarResultado}
                  disabled={guardandoResultado || !nuevoResultadoNombre.trim()}
                  className="h-11 px-4"
                >
                  {guardandoResultado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Lista */}
            {loadingResultados ? (
              <div className="flex justify-center pt-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tiposResultado.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <p className="text-sm font-semibold text-muted-foreground">Sin tipos de resultado</p>
                <p className="mt-1 text-xs text-muted-foreground">Agregá uno arriba para que aparezca en el registro de gestiones</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">Tareas ({tiposResultado.length})</h2>
                  <p className="text-[11px] text-muted-foreground">
                    {tiposResultado.filter((t) => t.activo).length} activos
                  </p>
                </div>
                <div className="space-y-2">
                  {tiposResultado.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        "rounded-2xl border bg-card p-3.5 shadow-card transition-smooth",
                        t.activo ? "border-border" : "border-dashed border-border opacity-55"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

                        <div className="flex-1 min-w-0">
                          {editandoResultado === t.id ? (
                            <Input
                              value={editNombre}
                              onChange={(e) => setEditNombre(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") guardarEdicion(t.id);
                                if (e.key === "Escape") setEditandoResultado(null);
                              }}
                              autoFocus
                              className="h-9 text-sm"
                            />
                          ) : (
                            <div className="space-y-1.5">
                              <p className="font-semibold text-sm leading-tight">{t.nombre}</p>
                              {t.tipo_formulario && (
                                <p className="text-[11px] text-primary font-semibold">
                                  {FORMULARIO_LABEL[t.tipo_formulario] ?? t.tipo_formulario}
                                </p>
                              )}
                              {/* Selector de cartera */}
                              <div className="flex gap-1">
                                {CARTERA_OPTIONS.map((opt) => {
                                  const isSelected = (t.tipo_cartera ?? "ambos") === opt.value;
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => actualizarCartera(t.id, opt.value)}
                                      className={cn(
                                        "rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-smooth",
                                        isSelected
                                          ? opt.color + " opacity-100"
                                          : "border-transparent bg-transparent text-muted-foreground opacity-50 hover:opacity-75"
                                      )}
                                    >
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {editandoResultado === t.id ? (
                            <>
                              <button
                                onClick={() => guardarEdicion(t.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-success hover:bg-success/10 transition-smooth"
                                title="Guardar"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditandoResultado(null)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-smooth"
                                title="Cancelar"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => { setEditandoResultado(t.id); setEditNombre(t.nombre); }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary transition-smooth"
                              title="Editar nombre"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Toggle activo/inactivo */}
                          <button
                            onClick={() => toggleActivo(t)}
                            className={cn(
                              "relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200",
                              t.activo ? "bg-primary" : "bg-muted"
                            )}
                            title={t.activo ? "Desactivar" : "Activar"}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200",
                                t.activo ? "translate-x-4" : "translate-x-0"
                              )}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground px-1 pt-1">
                  Desactivá tareas que ya no uses — no se elimina el historial. El ícono 📄 indica tareas con formulario de receptor (nombre, fecha, acta).
                </p>
              </div>
            )}
          </>
        )}

        {/* ──────────── EVENTOS ──────────── */}
        {seccion === "eventos" && (
          <>
            {loadingEventosCat ? (
              <div className="flex justify-center pt-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                {/* Rubros de Evento */}
                <div className="rounded-2xl border border-amber-300 bg-amber-50/40 dark:bg-amber-950/20 p-4 shadow-card space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Rubros de Evento</p>
                  <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70">Clasificación principal del venue (ej: BAILE, CASA FIESTA, CONCIERTO...)</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nombre del rubro..."
                      value={nuevoRubroEvento}
                      onChange={(e) => setNuevoRubroEvento(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && agregarRubroEvento()}
                      className="h-11 flex-1"
                    />
                    <Button onClick={agregarRubroEvento} disabled={guardandoRubroEvento} className="h-11 px-4 bg-amber-600 hover:bg-amber-700 text-white border-0">
                      {guardandoRubroEvento ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="space-y-1.5 mt-1">
                    {rubrosEvento.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Sin rubros — agregá uno arriba</p>
                    ) : rubrosEvento.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
                        <span className={cn("flex-1 text-sm font-semibold", !r.activo && "line-through text-muted-foreground")}>{r.nombre}</span>
                        <button
                          onClick={() => toggleRubroEvento(r.id, r.activo)}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none",
                            r.activo ? "bg-amber-500" : "bg-muted"
                          )}
                        >
                          <span className={cn("pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200", r.activo ? "translate-x-4" : "translate-x-0")} />
                        </button>
                        <button onClick={() => eliminarRubroEvento(r.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tipos de Evento */}
                <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipos de Evento</p>
                  <p className="text-[11px] text-muted-foreground">Tipo específico del evento al crear cada ID de Gestión (ej: BODA, CONCIERTO, CUMPLEAÑO...)</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nombre del tipo..."
                      value={nuevoTipoEvento}
                      onChange={(e) => setNuevoTipoEvento(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && agregarTipoEvento()}
                      className="h-11 flex-1"
                    />
                    <Button onClick={agregarTipoEvento} disabled={guardandoTipoEvento} className="h-11 px-4">
                      {guardandoTipoEvento ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="space-y-1.5 mt-1">
                    {tiposEvento.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Sin tipos — agregá uno arriba</p>
                    ) : tiposEvento.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
                        <span className={cn("flex-1 text-sm", !t.activo && "line-through text-muted-foreground")}>{t.nombre}</span>
                        <button
                          onClick={() => toggleTipoEvento(t.id, t.activo)}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
                            t.activo ? "bg-primary" : "bg-muted"
                          )}
                        >
                          <span className={cn("pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200", t.activo ? "translate-x-4" : "translate-x-0")} />
                        </button>
                        <button onClick={() => eliminarTipoEvento(t.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

      </div>
    </>
  );
};

export default Admin;
