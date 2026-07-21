import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Tag, ChevronUp, ChevronDown, Trash2, Clock, Calendar, Save } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Categoria { id: string; nombre: string; }
interface Rubro { id: string; categoria_id: string; nombre: string; dias_visita: number | null; dias_vigencia: number | null; }
interface SubRubro { id: string; rubro_id: string; nombre: string; }

/**
 * Sección CATÁLOGO del panel Admin: CRUD de categorías, rubros (con plazos de
 * visita/vigencia) y sub-rubros. Extraída de Admin.tsx como componente
 * autocontenido (maneja su propio estado y carga de datos).
 */
export const CatalogoSection = () => {
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

  useEffect(() => { cargarCatalogo(); }, []);

  return (
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
  );
};
