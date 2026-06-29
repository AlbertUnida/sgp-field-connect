import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, CalendarDays } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Categoria { id: string; nombre: string; }
interface Rubro { id: string; categoria_id: string; nombre: string; }

const TIPOS_EVENTO = [
  { value: "casamiento",  label: "Casamiento" },
  { value: "quinceanos",  label: "Quinceaños" },
  { value: "corporativo", label: "Corporativo" },
  { value: "social",      label: "Social / Privado" },
  { value: "musical",     label: "Musical / Show" },
  { value: "otro",        label: "Otro" },
];

const NuevoEvento = () => {
  const { id: clienteId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [clienteNombre, setClienteNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [rubrosFiltrados, setRubrosFiltrados] = useState<Rubro[]>([]);

  const [form, setForm] = useState({
    nombre_evento: "",
    fecha_evento: "",
    tipo_evento: "",
    tarifa_evento: "",
    categoria_id: "",
    rubro_id: "",
    nombre_salon: "",
    capacidad: "",
    notas: "",
  });

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  useEffect(() => {
    if (!clienteId) return;
    supabase
      .from("clientes")
      .select("nombre_comercial")
      .eq("id", clienteId)
      .single()
      .then(({ data }) => setClienteNombre(data?.nombre_comercial ?? ""));

    supabase.from("categorias").select("*").order("nombre").then(({ data }) => setCategorias(data ?? []));
    supabase.from("rubros").select("*").order("nombre").then(({ data }) => setRubros(data ?? []));
  }, [clienteId]);

  useEffect(() => {
    if (form.categoria_id) {
      setRubrosFiltrados(rubros.filter((r) => r.categoria_id === form.categoria_id));
      setForm((p) => ({ ...p, rubro_id: "" }));
    } else {
      setRubrosFiltrados([]);
    }
  }, [form.categoria_id, rubros]);

  const guardar = async () => {
    if (!form.nombre_evento.trim()) { toast.error("El nombre del evento es obligatorio"); return; }
    if (!form.fecha_evento) { toast.error("La fecha del evento es obligatoria"); return; }
    if (!form.tipo_evento) { toast.error("Seleccioná el tipo de evento"); return; }

    setGuardando(true);

    const { error } = await supabase.from("eventos_agenda").insert({
      cliente_id: parseInt(clienteId!),
      nombre_evento: form.nombre_evento.trim(),
      fecha_evento: form.fecha_evento,
      tipo_evento: form.tipo_evento,
      tarifa_evento: form.tarifa_evento ? parseInt(form.tarifa_evento.replace(/\D/g, "")) : null,
      categoria_id: form.categoria_id || null,
      rubro_id: form.rubro_id || null,
      nombre_salon: form.nombre_salon.trim() || null,
      capacidad: form.capacidad ? parseInt(form.capacidad.replace(/\D/g, "")) || null : null,
      notas: form.notas.trim() || null,
      estado: "prospecto",
      ejecutivo_id: user!.id,
      created_by: user!.id,
    });

    if (error) {
      toast.error("Error al crear el evento: " + error.message);
      setGuardando(false);
      return;
    }

    toast.success("✅ Evento creado");
    navigate(`/app/clientes/${clienteId}`);
  };

  return (
    <>
      <AppHeader title="Nuevo evento" subtitle={clienteNombre} />

      <div className="px-4 pt-4 pb-8 space-y-5">

        {/* Datos del evento */}
        <div className="rounded-2xl border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-4 shadow-card space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Datos del evento</p>

          <Campo
            label="Nombre del evento"
            required
            placeholder="Casamiento García – López"
            value={form.nombre_evento}
            onChange={(v) => set("nombre_evento", v)}
          />

          <div className="space-y-1.5">
            <Label>Fecha del evento <span className="text-destructive">*</span></Label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                value={form.fecha_evento}
                onChange={(e) => set("fecha_evento", e.target.value)}
                className="h-11 pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de evento <span className="text-destructive">*</span></Label>
            <select
              value={form.tipo_evento}
              onChange={(e) => set("tipo_evento", e.target.value)}
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">Seleccioná un tipo...</option>
              {TIPOS_EVENTO.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <Campo
            label="Tarifa del evento (Gs.)"
            placeholder="500000"
            value={form.tarifa_evento}
            onChange={(v) => set("tarifa_evento", v)}
            type="number"
          />
        </div>

        {/* Clasificación del evento */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Clasificación</p>

          <div className="space-y-1.5">
            <Label>Categoría</Label>
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
            <Label>Rubro</Label>
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
        </div>

        {/* Datos del venue */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Datos del venue</p>
          <Campo
            label="Nombre del salón / espacio"
            placeholder="Salón Los Pinos"
            value={form.nombre_salon}
            onChange={(v) => set("nombre_salon", v)}
          />
          <Campo
            label="Capacidad / Aforo (personas)"
            placeholder="300"
            value={form.capacidad}
            onChange={(v) => set("capacidad", v)}
            type="number"
          />
        </div>

        {/* Notas */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notas</p>
          <Textarea
            placeholder="Observaciones sobre el evento..."
            value={form.notas}
            onChange={(e) => set("notas", e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        <Button onClick={guardar} disabled={guardando} className="h-13 w-full gap-2 text-base font-semibold">
          {guardando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {guardando ? "Guardando..." : "Crear evento"}
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

export default NuevoEvento;
