import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, GripVertical, Loader2, Pencil, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TipoResultado {
  id: string;
  nombre: string;
  tipo_formulario: string | null;
  activo: boolean;
  orden: number;
  tipo_cartera: string;
}

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

/**
 * Sección TAREAS/RESULTADOS del panel Admin: CRUD de tipos_resultado
 * (nombre, cartera, formulario, activo). Extraída como componente autocontenido.
 */
export const ResultadosSection = () => {
  const [tiposResultado, setTiposResultado] = useState<TipoResultado[]>([]);
  const [loadingResultados, setLoadingResultados] = useState(false);
  const [nuevoResultadoNombre, setNuevoResultadoNombre] = useState("");
  const [guardandoResultado, setGuardandoResultado] = useState(false);
  const [editandoResultado, setEditandoResultado] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");

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

  useEffect(() => { cargarResultados(); }, []);

  return (
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
  );
};
