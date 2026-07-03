import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, CalendarDays } from "lucide-react";
import { parseMontoPYG } from "@/lib/mock-data";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface RubroEvento { id: string; nombre: string; }
interface TipoEvento  { id: string; nombre: string; }

const NuevoEvento = () => {
  const { id: clienteId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [clienteNombre, setClienteNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [rubrosEvento, setRubrosEvento] = useState<RubroEvento[]>([]);
  const [tiposEvento, setTiposEvento] = useState<TipoEvento[]>([]);

  const [form, setForm] = useState({
    rubro_evento_id: "",
    nombre_evento: "",
    fecha_evento: "",
    tipo_evento: "",
    tarifa_evento: "",
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

    supabase.from("rubros_evento").select("id, nombre").eq("activo", true).order("nombre").then(({ data }) => setRubrosEvento(data ?? []));
    supabase.from("tipos_evento").select("id, nombre").eq("activo", true).order("nombre").then(({ data }) => setTiposEvento(data ?? []));
  }, [clienteId]);

  const guardar = async () => {
    if (!form.rubro_evento_id) { toast.error("Seleccioná el rubro del evento"); return; }
    if (!form.nombre_evento.trim()) { toast.error("El nombre del evento es obligatorio"); return; }
    if (!form.fecha_evento) { toast.error("La fecha del evento es obligatoria"); return; }
    if (!form.tipo_evento) { toast.error("Seleccioná el tipo de evento"); return; }

    setGuardando(true);

    const { error } = await supabase.from("eventos_agenda").insert({
      cliente_id: parseInt(clienteId!),
      rubro_evento_id: form.rubro_evento_id,
      nombre_evento: form.nombre_evento.trim(),
      fecha_evento: form.fecha_evento,
      tipo_evento: form.tipo_evento,
      tarifa_evento: parseMontoPYG(form.tarifa_evento),
      nombre_salon: form.nombre_salon.trim() || null,
      capacidad: parseMontoPYG(form.capacidad),
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
              {tiposEvento.map((t) => (
                <option key={t.id} value={t.nombre}>{t.nombre}</option>
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
            <Label>Rubro <span className="text-destructive">*</span></Label>
            <select
              value={form.rubro_evento_id}
              onChange={(e) => set("rubro_evento_id", e.target.value)}
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">Seleccioná un rubro...</option>
              {rubrosEvento.map((r) => (
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
