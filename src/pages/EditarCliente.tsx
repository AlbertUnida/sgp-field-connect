import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

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
      tarifa_mensual: form.tarifa_mensual ? parseInt(form.tarifa_mensual.replace(/\D/g, "")) : null,
      notas: form.notas.trim() || null,
      categoria_id: form.categoria_id || null,
      rubro_id: form.rubro_id || null,
      sub_rubro_id: form.sub_rubro_id || null,
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
