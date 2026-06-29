import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Categoria { id: string; nombre: string; }
interface Rubro { id: string; categoria_id: string; nombre: string; }
interface SubRubro { id: string; rubro_id: string; nombre: string; }

const NuevoCliente = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [subRubros, setSubRubros] = useState<SubRubro[]>([]);
  const [rubrosFiltrados, setRubrosFiltrados] = useState<Rubro[]>([]);
  const [subRubrosFiltrados, setSubRubrosFiltrados] = useState<SubRubro[]>([]);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState({
    tipo_cliente: "local" as "local" | "evento",
    categoria_id: "",
    rubro_id: "",
    sub_rubro_id: "",
    nombre_comercial: "",
    razon_social: "",
    ruc: "",
    telefono: "",
    ciudad: "",
    localidad: "",
    barrio: "",
    direccion: "",
    calle_secundaria: "",
    monto_licencia: "",
    // Campos específicos de Venue (casa de fiestas)
    nombre_salon: "",
    capacidad: "",
  });

  useEffect(() => {
    supabase.from("categorias").select("*").order("nombre").then(({ data }) => setCategorias(data ?? []));
    supabase.from("rubros").select("*").order("nombre").then(({ data }) => setRubros(data ?? []));
    supabase.from("sub_rubros").select("*").order("nombre").then(({ data }) => setSubRubros(data ?? []));
  }, []);

  useEffect(() => {
    if (form.categoria_id) {
      setRubrosFiltrados(rubros.filter((r) => r.categoria_id === form.categoria_id));
      setForm((p) => ({ ...p, rubro_id: "", sub_rubro_id: "" }));
    } else {
      setRubrosFiltrados([]);
      setSubRubrosFiltrados([]);
    }
  }, [form.categoria_id, rubros]);

  useEffect(() => {
    if (form.rubro_id) {
      setSubRubrosFiltrados(subRubros.filter((s) => s.rubro_id === form.rubro_id));
      setForm((p) => ({ ...p, sub_rubro_id: "" }));
    } else {
      setSubRubrosFiltrados([]);
    }
  }, [form.rubro_id, subRubros]);

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const guardar = async () => {
    if (!form.nombre_comercial.trim()) { toast.error("El nombre del local es obligatorio"); return; }
    if (form.tipo_cliente === "local") {
      if (!form.categoria_id) { toast.error("Seleccioná una categoría"); return; }
      if (!form.rubro_id) { toast.error("Seleccioná un rubro"); return; }
    }

    setGuardando(true);

    const payload = {
      nombre_comercial: form.nombre_comercial.trim(),
      razon_social: form.razon_social.trim() || null,
      ruc: form.ruc.trim() || null,
      telefono: form.telefono.trim() || null,
      ciudad: form.ciudad.trim() || null,
      localidad: form.localidad.trim() || null,
      barrio: form.barrio.trim() || null,
      direccion: form.direccion.trim() || null,
      calle_secundaria: form.calle_secundaria.trim() || null,
      tarifa_mensual: form.tipo_cliente === "local" && form.monto_licencia ? parseInt(form.monto_licencia.replace(/\D/g, "")) : null,
      categoria_id: form.tipo_cliente === "local" ? form.categoria_id : null,
      rubro_id: form.tipo_cliente === "local" ? form.rubro_id : null,
      sub_rubro_id: form.tipo_cliente === "local" ? (form.sub_rubro_id || null) : null,
      tipo_cliente: form.tipo_cliente,
      nombre_salon: form.tipo_cliente === "evento" ? form.nombre_salon.trim() || null : null,
      capacidad: null,
      instancia: form.tipo_cliente === "evento" ? "COMERCIAL" : "CENSO",
      estado: "activo",
      activo: true,
      // Locales: quedan sin asignar hasta que supervisor asigne
      // Eventos: se asignan automáticamente al ejecutivo que los crea
      ejecutivo_id: form.tipo_cliente === "evento" ? user!.id : null,
      creado_por: user!.id,
    };

    const { error } = await supabase.from("clientes").insert(payload);

    if (error) {
      toast.error("Error al guardar: " + error.message);
      setGuardando(false);
      return;
    }

    toast.success(
      form.tipo_cliente === "evento"
        ? "✅ Evento creado — podés iniciar la gestión de inmediato"
        : "✅ Cliente creado en CENSO — un supervisor lo asignará a tu cartera"
    );
    navigate(-1);
  };

  return (
    <>
      <AppHeader
        title="Nuevo cliente"
        subtitle={form.tipo_cliente === "local" ? "Local permanente" : "Evento ocasional"}
      />

      <div className="px-4 pt-4 pb-8 space-y-5">

        {/* Tipo de cliente */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo de cliente</p>
          <div className="grid grid-cols-2 gap-2">
            <TipoBtn
              active={form.tipo_cliente === "local"}
              onClick={() => set("tipo_cliente", "local")}
              titulo="Local"
              desc="Permanente · requiere asignación"
            />
            <TipoBtn
              active={form.tipo_cliente === "evento"}
              onClick={() => set("tipo_cliente", "evento")}
              titulo="Evento"
              desc="Ocasional · pasa directo a Comercial"
            />
          </div>
        </div>

        {/* Categoría y Rubro — solo para locales */}
        {form.tipo_cliente === "local" && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Clasificación</p>

          <div className="space-y-1.5">
            <Label>Categoría <span className="text-destructive">*</span></Label>
            <select
              value={form.categoria_id}
              onChange={(e) => set("categoria_id", e.target.value)}
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">Seleccioná una categoría...</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Rubro <span className="text-destructive">*</span></Label>
            <select
              value={form.rubro_id}
              onChange={(e) => set("rubro_id", e.target.value)}
              disabled={!form.categoria_id}
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-50"
            >
              <option value="">
                {form.categoria_id ? "Seleccioná un rubro..." : "Primero elegí una categoría"}
              </option>
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

        {/* Datos del local / venue */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {form.tipo_cliente === "evento" ? "Datos del venue" : "Datos del local"}
          </p>

          <Campo
            label={form.tipo_cliente === "evento" ? "Nombre del venue" : "Nombre del local"}
            required
            placeholder={form.tipo_cliente === "evento" ? "TALLEYRAND, LA FIESTA..." : "Bar Don Pedro"}
            value={form.nombre_comercial}
            onChange={(v) => set("nombre_comercial", v)}
          />
          <Campo label="Razón Social" placeholder="Don Pedro SA" value={form.razon_social} onChange={(v) => set("razon_social", v)} />
          <Campo label="RUC" placeholder="80012345-6" value={form.ruc} onChange={(v) => set("ruc", v)} />
          <Campo label="Teléfono" placeholder="+595 981 123-456" value={form.telefono} onChange={(v) => set("telefono", v)} type="tel" />
          {form.tipo_cliente === "evento" && (
            <Campo
              label="Lugar del evento"
              placeholder="Salón Principal, Av. España 1234"
              value={form.nombre_salon}
              onChange={(v) => set("nombre_salon", v)}
            />
          )}
        </div>


        {/* Dirección */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ubicación</p>

          <Campo label="Ciudad" placeholder="Asunción" value={form.ciudad} onChange={(v) => set("ciudad", v)} />
          <Campo label="Localidad / Distrito" placeholder="San Lorenzo" value={form.localidad} onChange={(v) => set("localidad", v)} />
          <Campo label="Barrio" placeholder="Villa Morra" value={form.barrio} onChange={(v) => set("barrio", v)} />
          <Campo label="Calle principal" placeholder="Av. España 1234" value={form.direccion} onChange={(v) => set("direccion", v)} />
          <Campo label="Calle secundaria" placeholder="Esq. Brasil" value={form.calle_secundaria} onChange={(v) => set("calle_secundaria", v)} />
        </div>

        {/* Monto — solo para locales permanentes */}
        {form.tipo_cliente === "local" && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Licencia</p>
            <Campo label="Monto estimado (Gs.)" placeholder="500000" value={form.monto_licencia} onChange={(v) => set("monto_licencia", v)} type="number" />
          </div>
        )}

        {/* Info según tipo */}
        <div className={cn(
          "rounded-2xl border p-4 text-sm",
          form.tipo_cliente === "local"
            ? "border-warning/40 bg-warning/5 text-warning"
            : "border-success/40 bg-success/5 text-success"
        )}>
          {form.tipo_cliente === "local"
            ? "⏳ Este cliente quedará en CENSO hasta que un Supervisor o Admin lo asigne a un ejecutivo para iniciar la gestión comercial."
            : "⚡ Al ser un evento ocasional, quedará asignado a vos y podrás iniciar la gestión comercial de inmediato."}
        </div>

        <Button onClick={guardar} disabled={guardando} className="h-13 w-full gap-2 text-base font-semibold">
          {guardando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {guardando ? "Guardando..." : "Crear cliente"}
        </Button>

        <Button variant="ghost" className="w-full" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Cancelar
        </Button>
      </div>
    </>
  );
};

const Campo = ({ label, placeholder, value, onChange, required, type = "text" }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; required?: boolean; type?: string;
}) => (
  <div className="space-y-1.5">
    <Label>{label}{required && <span className="text-destructive ml-1">*</span>}</Label>
    <Input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="h-11" />
  </div>
);

const TipoBtn = ({ active, onClick, titulo, desc }: {
  active: boolean; onClick: () => void; titulo: string; desc: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-xl border p-3 text-left transition-smooth",
      active ? "border-primary bg-primary/10" : "border-border bg-secondary"
    )}
  >
    <p className={cn("text-sm font-bold", active ? "text-primary" : "text-foreground")}>{titulo}</p>
    <p className="mt-0.5 text-[10px] text-muted-foreground leading-snug">{desc}</p>
  </button>
);

export default NuevoCliente;
