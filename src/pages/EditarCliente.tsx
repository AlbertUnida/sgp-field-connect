import { useEffect, useState } from "react";
import { parseMontoPYG } from "@/lib/format";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, MapPin, LocateFixed, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapaUbicacionPicker } from "@/components/MapaUbicacionPicker";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

/** Parsea "lat, lng" (formato de Google Maps / app de visitas) a números válidos. */
const parseLatLng = (texto: string): { lat: number; lng: number } | null => {
  const m = texto.trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

interface Categoria { id: string; nombre: string; }
interface Rubro { id: string; categoria_id: string; nombre: string; }
interface SubRubro { id: string; rubro_id: string; nombre: string; }

const EditarCliente = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { isAdmin, canManage, loading: profileLoading } = useProfile();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [subRubros, setSubRubros] = useState<SubRubro[]>([]);
  const [rubrosFiltrados, setRubrosFiltrados] = useState<Rubro[]>([]);
  const [subRubrosFiltrados, setSubRubrosFiltrados] = useState<SubRubro[]>([]);

  const [tipoCliente, setTipoCliente] = useState<"local" | "evento">("local");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [pegarCoord, setPegarCoord] = useState("");
  const [ubicandoGps, setUbicandoGps] = useState(false);
  const [form, setForm] = useState({
    nombre_comercial: "",
    razon_social: "",
    ruc: "",
    telefono: "",
    email_cliente: "",
    ciudad: "",
    localidad: "",
    barrio: "",
    direccion: "",
    calle_secundaria: "",
    tarifa_mensual: "",
    notas: "",
    categoria_id: "",
    rubro_id: "",
    sub_rubro_id: "",
    // Campos del venue
    nombre_salon: "",
    capacidad: "",
  });

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  useEffect(() => {
    if (!id || profileLoading) return;
    Promise.all([
      supabase.from("categorias").select("*").order("nombre"),
      supabase.from("rubros").select("*").order("nombre"),
      supabase.from("sub_rubros").select("*").order("nombre"),
      supabase.from("clientes").select("*").eq("id", id).single(),
    ]).then(([{ data: cats }, { data: rubs }, { data: subRubs }, { data: cliente, error }]) => {
      setCategorias(cats ?? []);
      setRubros(rubs ?? []);
      setSubRubros(subRubs ?? []);

      if (error || !cliente) {
        toast.error("Cliente no encontrado");
        navigate(-1);
        return;
      }

      // Verificar permiso:
      // - canManage (admin/supervisor): siempre puede
      // - ejecutivo asignado (ejecutivo_id): puede editar su cliente
      // - ejecutivo creador (creado_por) + instancia CENSO: puede editar para cargar tarifa
      const esAsignado = cliente.ejecutivo_id === user?.id;
      const esCreadorCenso = cliente.creado_por === user?.id && cliente.instancia === "CENSO";
      if (!canManage && !esAsignado && !esCreadorCenso) {
        toast.error("No tenés permiso para editar este cliente");
        navigate(-1);
        return;
      }

      setTipoCliente(cliente.tipo_cliente === "evento" ? "evento" : "local");
      setLat(cliente.lat != null ? Number(cliente.lat) : null);
      setLng(cliente.lng != null ? Number(cliente.lng) : null);
      setForm({
        nombre_comercial: cliente.nombre_comercial ?? "",
        razon_social: cliente.razon_social ?? "",
        ruc: cliente.ruc ?? "",
        telefono: cliente.telefono ?? "",
        email_cliente: cliente.email_cliente ?? "",
        ciudad: cliente.ciudad ?? "",
        localidad: cliente.localidad ?? "",
        barrio: cliente.barrio ?? "",
        direccion: cliente.direccion ?? "",
        calle_secundaria: cliente.calle_secundaria ?? "",
        tarifa_mensual: cliente.tarifa_mensual ? String(cliente.tarifa_mensual) : "",
        notas: cliente.notas ?? "",
        categoria_id: cliente.categoria_id ?? "",
        rubro_id: cliente.rubro_id ?? "",
        sub_rubro_id: cliente.sub_rubro_id ?? "",
        nombre_salon: cliente.nombre_salon ?? "",
        capacidad: cliente.capacidad ? String(cliente.capacidad) : "",
      });
      setLoading(false);
    });
  }, [id, canManage, profileLoading, user]);

  useEffect(() => {
    if (form.categoria_id) {
      setRubrosFiltrados(rubros.filter((r) => r.categoria_id === form.categoria_id));
    } else {
      setRubrosFiltrados([]);
      setSubRubrosFiltrados([]);
    }
  }, [form.categoria_id, rubros]);

  useEffect(() => {
    if (form.rubro_id) {
      setSubRubrosFiltrados(subRubros.filter((s) => s.rubro_id === form.rubro_id));
    } else {
      setSubRubrosFiltrados([]);
    }
  }, [form.rubro_id, subRubros]);

  const guardar = async () => {
    if (!form.nombre_comercial.trim()) {
      toast.error("El nombre del local es obligatorio");
      return;
    }

    setGuardando(true);

    const { error, count } = await supabase.from("clientes").update({
      nombre_comercial: form.nombre_comercial.trim(),
      razon_social: form.razon_social.trim() || null,
      ruc: form.ruc.trim() || null,
      telefono: form.telefono.trim() || null,
      email_cliente: form.email_cliente.trim() || null,
      ciudad: form.ciudad.trim() || null,
      localidad: form.localidad.trim() || null,
      barrio: form.barrio.trim() || null,
      direccion: form.direccion.trim() || null,
      calle_secundaria: form.calle_secundaria.trim() || null,
      tarifa_mensual: parseMontoPYG(form.tarifa_mensual),
      notas: form.notas.trim() || null,
      categoria_id: form.categoria_id || null,
      rubro_id: form.rubro_id || null,
      sub_rubro_id: form.sub_rubro_id || null,
      // Campos del venue
      nombre_salon: tipoCliente === "evento" ? form.nombre_salon.trim() || null : null,
      capacidad: tipoCliente === "evento" ? parseMontoPYG(form.capacidad) : null,
      // Georreferenciación (carga manual de managers)
      lat,
      lng,
    }, { count: "exact" }).eq("id", id);

    if (error) {
      toast.error("Error al guardar: " + error.message);
      setGuardando(false);
      return;
    }

    if (count === 0) {
      toast.error("No se pudo guardar: sin permiso de escritura. Pedile al administrador que ejecute la migración de permisos en Supabase.");
      setGuardando(false);
      return;
    }

    toast.success("Cliente actualizado ✅");
    navigate(`/app/clientes/${id}`);
  };

  const usarMiUbicacion = () => {
    if (!navigator.geolocation) { toast.error("GPS no disponible en este dispositivo"); return; }
    setUbicandoGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setUbicandoGps(false);
        toast.success("Ubicación tomada del GPS");
      },
      () => { setUbicandoGps(false); toast.error("No se pudo obtener el GPS"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const aplicarPegado = (texto: string) => {
    setPegarCoord(texto);
    const p = parseLatLng(texto);
    if (p) { setLat(p.lat); setLng(p.lng); }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <AppHeader title="Editar cliente" subtitle={form.nombre_comercial} />

      <div className="px-4 pt-4 pb-8 space-y-5">

        {/* Datos principales */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Datos del local</p>

          <Campo label="Nombre del local / Evento" required placeholder="Bar Don Pedro"
            value={form.nombre_comercial} onChange={(v) => set("nombre_comercial", v)} />
          <Campo label="Razón Social" placeholder="Don Pedro SA"
            value={form.razon_social} onChange={(v) => set("razon_social", v)} />
          <Campo label="RUC" placeholder="80012345-6"
            value={form.ruc} onChange={(v) => set("ruc", v)} />
          <Campo label="Teléfono" placeholder="+595 981 123-456"
            value={form.telefono} onChange={(v) => set("telefono", v)} type="tel" />
          <Campo label="Email" placeholder="contacto@local.com"
            value={form.email_cliente} onChange={(v) => set("email_cliente", v)} type="email" />
        </div>

        {/* Campos específicos del Venue */}
        {tipoCliente === "evento" && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-4 shadow-card space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Datos del venue</p>
            <Campo label="Nombre del salón / espacio" placeholder="Salón Los Pinos" value={form.nombre_salon} onChange={(v) => set("nombre_salon", v)} />
            <Campo label="Capacidad / Aforo (personas)" placeholder="300" value={form.capacidad} onChange={(v) => set("capacidad", v)} type="number" />
          </div>
        )}

        {/* Clasificación — canManage (admin/supervisor) puede cambiar categoría/rubro */}
        {canManage && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Clasificación</p>

            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <select
                value={form.categoria_id}
                onChange={(e) => { set("categoria_id", e.target.value); set("rubro_id", ""); set("sub_rubro_id", ""); }}
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Rubro</Label>
              <select
                value={form.rubro_id}
                onChange={(e) => { set("rubro_id", e.target.value); set("sub_rubro_id", ""); }}
                disabled={!form.categoria_id}
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="">Sin rubro</option>
                {rubrosFiltrados.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>

            {subRubrosFiltrados.length > 0 && (
              <div className="space-y-1.5">
                <Label>Sub Rubro <span className="text-muted-foreground text-[11px] font-normal">(opcional)</span></Label>
                <select
                  value={form.sub_rubro_id}
                  onChange={(e) => set("sub_rubro_id", e.target.value)}
                  className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="">Sin sub rubro</option>
                  {subRubrosFiltrados.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Ubicación */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ubicación</p>

          <Campo label="Ciudad" placeholder="Asunción"
            value={form.ciudad} onChange={(v) => set("ciudad", v)} />
          <Campo label="Localidad / Distrito" placeholder="San Lorenzo"
            value={form.localidad} onChange={(v) => set("localidad", v)} />
          <Campo label="Barrio" placeholder="Villa Morra"
            value={form.barrio} onChange={(v) => set("barrio", v)} />
          <Campo label="Calle principal" placeholder="Av. España 1234"
            value={form.direccion} onChange={(v) => set("direccion", v)} />
          <Campo label="Calle secundaria" placeholder="Esq. Brasil"
            value={form.calle_secundaria} onChange={(v) => set("calle_secundaria", v)} />

          {/* Georreferenciación (carga manual) — solo managers */}
          {canManage && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> Coordenadas del local
                </Label>
                {lat != null && lng != null && (
                  <button
                    type="button"
                    onClick={() => { setLat(null); setLng(null); setPegarCoord(""); }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" /> Quitar
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Pegar: -25.2894, -57.6624"
                  value={pegarCoord}
                  onChange={(e) => aplicarPegado(e.target.value)}
                  className="h-11 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={usarMiUbicacion}
                  disabled={ubicandoGps}
                  className="h-11 shrink-0 gap-1.5"
                >
                  {ubicandoGps ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                  GPS
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Pegá las coordenadas de Google Maps o de la app de visitas, tocá el mapa, o arrastrá el pin.
                {lat != null && lng != null && (
                  <span className="block mt-0.5 font-mono text-foreground">
                    {lat.toFixed(6)}, {lng.toFixed(6)}
                  </span>
                )}
              </p>

              <MapaUbicacionPicker
                lat={lat}
                lng={lng}
                onChange={(la, ln) => { setLat(la); setLng(ln); setPegarCoord(""); }}
              />
            </div>
          )}
        </div>

        {/* Licencia — campo clave */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-card space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Licencia</p>
          <p className="text-[11px] text-muted-foreground -mt-2">
            La tarifa es necesaria para poder asignar el cliente a un ejecutivo y pasar a COMERCIAL.
          </p>
          <Campo
            label="Tarifa mensual (Gs.)"
            placeholder="500000"
            value={form.tarifa_mensual}
            onChange={(v) => set("tarifa_mensual", v)}
            type="number"
            highlight
          />
        </div>

        {/* Notas internas */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notas internas</p>
          <Textarea
            placeholder="Observaciones, acuerdos, características del local..."
            value={form.notas}
            onChange={(e) => set("notas", e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        <Button onClick={guardar} disabled={guardando} className="h-13 w-full gap-2 text-base font-semibold">
          {guardando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {guardando ? "Guardando..." : "Guardar cambios"}
        </Button>

        <Button variant="ghost" className="w-full" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Cancelar
        </Button>
      </div>
    </>
  );
};

const Campo = ({
  label, placeholder, value, onChange, required, type = "text", highlight,
}: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; required?: boolean; type?: string; highlight?: boolean;
}) => (
  <div className="space-y-1.5">
    <Label className={highlight ? "text-primary font-bold" : ""}>
      {label}{required && <span className="text-destructive ml-1">*</span>}
    </Label>
    <Input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-11 ${highlight ? "border-primary/40 focus:border-primary" : ""}`}
    />
  </div>
);

export default EditarCliente;
