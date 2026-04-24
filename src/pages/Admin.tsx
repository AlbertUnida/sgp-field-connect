import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Users, Target, ChevronDown, ChevronUp, Save, Shield, UserCheck,
  Eye, Loader2, Plus, Building2, Trash2, Tag, MapPin, ChevronRight
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { useProfile, Profile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatPYG } from "@/lib/mock-data";

interface EjecutivoConMeta extends Profile {
  meta_actual: number | null;
}

interface Categoria { id: string; nombre: string; }
interface Rubro { id: string; categoria_id: string; nombre: string; }
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

type Seccion = "ejecutivos" | "censo" | "catalogo";

const Admin = () => {
  const { isAdmin, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const [seccion, setSeccion] = useState<Seccion>("ejecutivos");

  // ── EJECUTIVOS ──
  const [ejecutivos, setEjecutivos] = useState<EjecutivoConMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [metas, setMetas] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
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
  const [loadingCat, setLoadingCat] = useState(false);
  const [catExpandida, setCatExpandida] = useState<string | null>(null);
  const [nuevaCat, setNuevaCat] = useState("");
  const [guardandoCat, setGuardandoCat] = useState(false);
  const [nuevoRubroNombre, setNuevoRubroNombre] = useState<Record<string, string>>({});
  const [guardandoRubro, setGuardandoRubro] = useState<string | null>(null);

  useEffect(() => {
    if (!profileLoading && !isAdmin) navigate("/app");
  }, [isAdmin, profileLoading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    cargarEjecutivos();
  }, [isAdmin]);

  useEffect(() => {
    if (seccion === "censo") cargarCenso();
    if (seccion === "catalogo") cargarCatalogo();
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
    lista.forEach((e) => { metasInit[e.id] = e.meta_actual ? String(e.meta_actual) : ""; });
    setMetas(metasInit);
    setLoading(false);
  };

  const guardarMeta = async (ejecutivoId: string) => {
    const monto = parseInt(metas[ejecutivoId]?.replace(/\D/g, "") || "0");
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

  const cambiarRol = async (ejecutivoId: string, rol: string) => {
    const { error } = await supabase.from("profiles").update({ rol }).eq("id", ejecutivoId);
    if (error) toast.error("Error al cambiar el rol");
    else { toast.success("Rol actualizado"); await cargarEjecutivos(); }
  };

  const crearUsuario = async () => {
    if (!nuevoEmail || !nuevaPassword || !nuevoNombre) { toast.error("Completá nombre, email y contraseña"); return; }
    setCreandoUser(true);
    const { data, error } = await supabase.auth.signUp({
      email: nuevoEmail,
      password: nuevaPassword,
      options: { data: { full_name: `${nuevoNombre} ${nuevoApellido}`.trim() } },
    });
    if (error || !data.user) { toast.error(error?.message || "Error al crear el usuario"); setCreandoUser(false); return; }
    await supabase.from("profiles").update({ nombre: nuevoNombre, apellido: nuevoApellido || null, rol: nuevoRol }).eq("id", data.user.id);
    toast.success(`Usuario ${nuevoNombre} creado ✅`);
    setNuevoEmail(""); setNuevoNombre(""); setNuevoApellido(""); setNuevaPassword(""); setNuevoRol("ejecutivo"); setShowNuevoUser(false);
    await cargarEjecutivos();
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

    const cliente = clientesCenso.find((c) => c.id === clienteId);
    if (!cliente?.tarifa_mensual) {
      toast.error("El cliente debe tener Tarifa Mensual antes de asignarlo");
      return;
    }

    setAsignando(clienteId);
    const { error } = await supabase.from("clientes").update({
      ejecutivo_id: ejecutivoId,
      instancia: "COMERCIAL",
    }).eq("id", clienteId);

    if (error) { toast.error("Error: " + error.message); setAsignando(null); return; }

    await supabase.from("historial_instancias").insert({
      cliente_id: parseInt(clienteId),
      instancia_anterior: "CENSO",
      instancia_nueva: "COMERCIAL",
      ejecutivo_id: ejecutivoId,
      notas: "Asignado desde panel Admin",
    });

    toast.success("Cliente asignado y movido a COMERCIAL ✅");
    await cargarCenso();
    setAsignando(null);
  };

  // ─── CATÁLOGO ─────────────────────────────────────────
  const cargarCatalogo = async () => {
    setLoadingCat(true);
    const [{ data: cats }, { data: rubs }] = await Promise.all([
      supabase.from("categorias").select("*").order("nombre"),
      supabase.from("rubros").select("*").order("nombre"),
    ]);
    setCategorias(cats ?? []);
    setRubros(rubs ?? []);
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
    const { error } = await supabase.from("rubros").insert({ nombre, categoria_id: categoriaId });
    if (error) toast.error("Error: " + error.message);
    else {
      toast.success("Rubro agregado");
      setNuevoRubroNombre((p) => ({ ...p, [categoriaId]: "" }));
      await cargarCatalogo();
    }
    setGuardandoRubro(null);
  };

  const eliminarRubro = async (id: string) => {
    const { error } = await supabase.from("rubros").delete().eq("id", id);
    if (error) toast.error("Error: " + error.message);
    else { toast.success("Rubro eliminado"); await cargarCatalogo(); }
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

  return (
    <>
      <AppHeader title="Administración" subtitle={`${MESES[MES_ACTUAL - 1]} ${ANIO_ACTUAL}`} />

      <div className="px-4 pt-5 pb-8 space-y-5">

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-border bg-card p-1.5">
          {([
            { key: "ejecutivos", label: "Equipo", icon: Users },
            { key: "censo",      label: "CENSO",  icon: Building2 },
            { key: "catalogo",   label: "Catálogo", icon: Tag },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSeccion(key)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-bold uppercase tracking-wide transition-smooth",
                seccion === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* ══ EQUIPO ══ */}
        {seccion === "ejecutivos" && (
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
                <div className="space-y-1.5"><Label>Contraseña inicial <span className="text-destructive">*</span></Label><Input type="password" placeholder="Mínimo 6 caracteres" value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} className="h-11" /></div>
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
                          <div className="space-y-1.5 pt-4">
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
              <Link to="/app/nuevo-cliente" className="text-xs font-semibold text-primary">+ Nuevo cliente</Link>
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
                          <option key={e.id} value={e.id}>{[e.nombre, e.apellido].filter(Boolean).join(" ") || e.email}</option>
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
                      placeholder="Ej: Gastronomía, Entretenimiento..."
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
                            <div className="flex items-center gap-3 p-4">
                              <button
                                className="flex-1 flex items-center gap-2 text-left"
                                onClick={() => setCatExpandida(isOpen ? null : cat.id)}
                              >
                                <Tag className="h-4 w-4 text-primary shrink-0" />
                                <span className="font-bold text-sm">{cat.nombre}</span>
                                <span className="text-[11px] text-muted-foreground ml-1">({rubrosDeCat.length})</span>
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
                                {/* Rubros existentes */}
                                {rubrosDeCat.length === 0 ? (
                                  <p className="text-xs text-muted-foreground py-1">Sin rubros — agregá uno abajo</p>
                                ) : (
                                  rubrosDeCat.map((r) => (
                                    <div key={r.id} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2">
                                      <span className="text-sm">{r.nombre}</span>
                                      <button
                                        onClick={() => eliminarRubro(r.id)}
                                        className="text-muted-foreground hover:text-destructive transition-smooth"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ))
                                )}

                                {/* Agregar rubro */}
                                <div className="flex gap-2 pt-1">
                                  <Input
                                    placeholder="Nuevo rubro..."
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
      </div>
    </>
  );
};

export default Admin;
