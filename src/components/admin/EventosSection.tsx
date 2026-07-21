import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface RubroEvento { id: string; nombre: string; activo: boolean; }
interface TipoEvento { id: string; nombre: string; activo: boolean; }

/**
 * Sección EVENTOS del panel Admin: CRUD de rubros y tipos de evento
 * (con toggle activo/inactivo). Extraída de Admin.tsx como componente
 * autocontenido (maneja su propio estado y carga de datos).
 */
export const EventosSection = () => {
  const [rubrosEvento, setRubrosEvento] = useState<RubroEvento[]>([]);
  const [tiposEvento, setTiposEvento] = useState<TipoEvento[]>([]);
  const [loadingEventosCat, setLoadingEventosCat] = useState(false);
  const [nuevoRubroEvento, setNuevoRubroEvento] = useState("");
  const [guardandoRubroEvento, setGuardandoRubroEvento] = useState(false);
  const [nuevoTipoEvento, setNuevoTipoEvento] = useState("");
  const [guardandoTipoEvento, setGuardandoTipoEvento] = useState(false);

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

  useEffect(() => { cargarCatalogoEventos(); }, []);

  return (
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
  );
};
