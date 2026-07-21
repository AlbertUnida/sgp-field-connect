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
import { SeguimientoSection } from "@/components/admin/SeguimientoSection";
import { EquipoSection } from "@/components/admin/EquipoSection";

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

  // ── CENSO (sin asignar) ──
  const [clientesCenso, setClientesCenso] = useState<ClienteCenso[]>([]);
  const [loadingCenso, setLoadingCenso] = useState(false);
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});
  const [asignando, setAsignando] = useState<string | null>(null);

  // ── CATÁLOGO ──


  // ── SEGUIMIENTO ──

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
    setLoading(false);
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
          <EquipoSection ejecutivos={ejecutivos} onReload={cargarEjecutivos} />
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
          <SeguimientoSection ejecutivos={ejecutivos} />
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
