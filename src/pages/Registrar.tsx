import { useEffect, useRef, useState } from "react";
import { Camera, MapPin, Phone, Car, Save, Calendar, Mail, Search, X, Loader2, MessageCircle, FileText, ImagePlus, Trash2, AlertCircle, Target } from "lucide-react";
import { RESULTADOS_GESTION } from "@/lib/resultados-gestion";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ClienteOpcion {
  id: string;
  numero_cliente: number | null;
  nombre_comercial: string;
  ciudad: string | null;
  instancia: string | null;
  tipo_cliente: string | null;
}

interface TipoResultado {
  id: string;
  nombre: string;
  tipo_formulario: "sin_medios" | "nota_comercial" | "nota_reclamo" | "visita_seguimiento" | "reunion" | null;
  tipo_cartera: string;
  activo: boolean;
  orden: number;
}

const TIPOS = [
  { key: "visita",   label: "Visita",    icon: Car },
  { key: "llamada",  label: "Llamada",   icon: Phone },
  { key: "email",    label: "Email",     icon: Mail },
  { key: "whatsapp", label: "WhatsApp",  icon: MessageCircle },
];

const Registrar = () => {
  const { user } = useAuth();
  const { canManage, nombreCompleto } = useProfile();

  // Clientes disponibles
  const [clientes, setClientes] = useState<ClienteOpcion[]>([]);
  const [cargandoClientes, setCargandoClientes] = useState(true);

  // Tipos de resultado dinámicos desde DB
  const [tiposResultado, setTiposResultado] = useState<TipoResultado[]>([]);
  const [cargandoResultados, setCargandoResultados] = useState(true);

  // Buscador
  const [busqueda, setBusqueda] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteOpcion | null>(null);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);

  // Selector de evento (para clientes tipo "evento")
  const [eventosCliente, setEventosCliente] = useState<{ id: string; numero_evento: number; nombre_evento: string | null; fecha_evento: string | null; estado: string }[]>([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState<string>(""); // evento_id
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Formulario base
  const [tipo, setTipo] = useState("visita");
  const [resultadoId, setResultadoId] = useState("");
  const [notas, setNotas] = useState("");
  const [proxima, setProxima] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Campos especiales — Nota Info & formularios con receptor
  const [receptorNombre, setReceptorNombre] = useState("");
  const [receptorApellido, setReceptorApellido] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [actaNro, setActaNro] = useState("");

  // Resultado real de la gestión
  const [resultadoReal, setResultadoReal] = useState("");
  const resultadoRealObj = RESULTADOS_GESTION.find((r) => r.key === resultadoReal) ?? null;

  // IDs de resultado ya completados para el cliente seleccionado (para filtro nota_reclamo)
  const [resultadosCompletadosCliente, setResultadosCompletadosCliente] = useState<Set<string>>(new Set());

  // GPS — captura automática, sin acción manual del ejecutivo
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsEstado, setGpsEstado] = useState<"idle" | "buscando" | "ok" | "error">("idle");

  // Foto
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  // Resultado seleccionado (objeto completo para saber tipo_formulario)
  const resultadoSeleccionado = tiposResultado.find((t) => t.id === resultadoId) ?? null;
  const tipoFormulario = resultadoSeleccionado?.tipo_formulario ?? null;

  // Filtrado secuencial de nota_reclamo + filtro por cartera del cliente seleccionado
  const tiposResultadoFiltrados = (() => {
    const tipoCarteraCliente = clienteSeleccionado?.tipo_cliente ?? "local";
    // Filtrar por cartera: mostrar solo los que aplican a este tipo de cliente
    const porCartera = tiposResultado.filter(
      (t) => t.tipo_cartera === "ambos" || t.tipo_cartera === tipoCarteraCliente
    );
    const notaReclamo = porCartera
      .filter((t) => t.tipo_formulario === "nota_reclamo")
      .sort((a, b) => a.orden - b.orden);
    const proxPendiente = notaReclamo.find((t) => !resultadosCompletadosCliente.has(t.id));
    return [
      ...porCartera.filter((t) => t.tipo_formulario !== "nota_reclamo"),
      ...(proxPendiente ? [proxPendiente] : []),
    ];
  })();

  // Promesa de GPS reutilizable
  const capturarGPSPromise = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  // Auto-captura cuando el tipo es visita
  useEffect(() => {
    if (tipo !== "visita") {
      setGps(null);
      setGpsEstado("idle");
      return;
    }
    setGpsEstado("buscando");
    capturarGPSPromise().then((coords) => {
      if (coords) { setGps(coords); setGpsEstado("ok"); }
      else { setGpsEstado("error"); }
    });
  }, [tipo]);

  useEffect(() => {
    if (!user) return;
    cargarClientes();
    cargarResultados();
  }, [user, canManage]);

  const cargarClientes = async () => {
    setCargandoClientes(true);
    let query = supabase
      .from("clientes")
      .select("id, numero_cliente, nombre_comercial, ciudad, instancia, tipo_cliente")
      .eq("activo", true)
      .order("nombre_comercial");

    if (!canManage) {
      query = query.eq("ejecutivo_id", user!.id);
    }

    const { data } = await query;
    setClientes(data ?? []);
    setCargandoClientes(false);
  };

  const cargarResultados = async () => {
    setCargandoResultados(true);
    const { data } = await supabase
      .from("tipos_resultado")
      .select("id, nombre, tipo_formulario, tipo_cartera, activo, orden")
      .eq("activo", true)
      .order("orden")
      .order("nombre");
    setTiposResultado(data ?? []);
    setCargandoResultados(false);
  };

  // Filtrar por texto o por ID numérico
  const clientesFiltrados = clientes.filter((c) => {
    if (!busqueda) return false;
    const q = busqueda.toLowerCase();
    const idStr = c.numero_cliente ? String(c.numero_cliente).padStart(4, "0") : "";
    const soloNumeros = busqueda.replace(/\D/g, "");
    return (
      c.nombre_comercial.toLowerCase().includes(q) ||
      (c.ciudad ?? "").toLowerCase().includes(q) ||
      (soloNumeros && idStr.includes(soloNumeros))
    );
  });

  const seleccionarCliente = async (c: ClienteOpcion) => {
    setClienteSeleccionado(c);
    setBusqueda(c.nombre_comercial);
    setMostrarDropdown(false);
    inputRef.current?.blur();
    setResultadoId("");
    setReceptorNombre(""); setReceptorApellido(""); setFechaEntrega("");
    setEventoSeleccionado("");
    // Fetch gestiones para filtro secuencial de nota_reclamo
    const { data } = await supabase
      .from("gestiones")
      .select("resultado_id")
      .eq("cliente_id", c.id)
      .not("resultado_id", "is", null);
    const ids = new Set<string>((data ?? []).map((g: any) => g.resultado_id).filter(Boolean));
    setResultadosCompletadosCliente(ids);
    // Si es venue de eventos, cargar sus eventos
    if (c.tipo_cliente === "evento") {
      const { data: evs } = await supabase
        .from("eventos_agenda")
        .select("id, numero_evento, nombre_evento, fecha_evento, estado")
        .eq("cliente_id", c.id)
        .in("estado", ["prospecto", "confirmado"])
        .order("fecha_evento", { ascending: true });
      setEventosCliente(evs ?? []);
    } else {
      setEventosCliente([]);
    }
  };

  const limpiarCliente = () => {
    setClienteSeleccionado(null);
    setBusqueda("");
    setMostrarDropdown(false);
    setResultadosCompletadosCliente(new Set());
    setEventosCliente([]);
    setEventoSeleccionado("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Limpiar campos especiales al cambiar tarea
  const handleResultadoChange = (id: string) => {
    setResultadoId(id);
    setReceptorNombre(""); setReceptorApellido(""); setFechaEntrega(""); setActaNro("");
    setResultadoReal("");
    // Auto-completar fecha de hoy para tareas con receptor
    const tipo = tiposResultado.find((t) => t.id === id);
    if (
      tipo?.tipo_formulario === "nota_comercial" ||
      tipo?.tipo_formulario === "nota_reclamo" ||
      tipo?.tipo_formulario === "visita_seguimiento" ||
      tipo?.tipo_formulario === "reunion"
    ) {
      setFechaEntrega(new Date().toISOString().split("T")[0]);
    }
  };

  // Cerrar dropdown al clic afuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setMostrarDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Marca de agua en foto
  const aplicarMarcaDeAgua = (file: File, nombre: string): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        const ahora = new Date();
        const fecha = ahora.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
        const hora = ahora.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const linea1 = nombre.toUpperCase();
        const linea2 = `${fecha}  •  ${hora}  •  SGP Paraguay`;

        const fontSize = Math.max(Math.round(img.width * 0.038), 22);
        const smallSize = Math.round(fontSize * 0.72);
        const padding = Math.round(fontSize * 0.7);
        const barHeight = fontSize + smallSize + padding * 2.5;

        ctx.fillStyle = "rgba(0, 0, 0, 0.70)";
        ctx.fillRect(0, img.height - barHeight, img.width, barHeight);

        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(0, img.height - barHeight, img.width, Math.round(fontSize * 0.18));

        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        ctx.fillText(linea1, padding, img.height - barHeight + padding);

        ctx.font = `${smallSize}px Arial, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillText(linea2, padding, img.height - barHeight + padding + fontSize + Math.round(smallSize * 0.3));

        URL.revokeObjectURL(objectUrl);

        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.92
        );
      };

      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    });
  };

  const seleccionarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const nombre = nombreCompleto || "Ejecutivo SGP";
    const fotoConMarca = await aplicarMarcaDeAgua(file, nombre);
    setFotoFile(fotoConMarca);
    setFotoPreview(URL.createObjectURL(fotoConMarca));
  };

  const quitarFoto = () => {
    setFotoFile(null);
    setFotoPreview(null);
    if (fotoInputRef.current) fotoInputRef.current.value = "";
  };

  const guardar = async () => {
    if (!clienteSeleccionado) { toast.error("Seleccioná un cliente"); return; }
    if (clienteSeleccionado.tipo_cliente === "evento" && !eventoSeleccionado) {
      toast.error("Seleccioná el evento para registrar la gestión"); return;
    }
    if (!resultadoId) { toast.error("Seleccioná la tarea realizada"); return; }
    if (!resultadoReal) { toast.error("Seleccioná el resultado de la gestión"); return; }

    // Validaciones de formularios especiales
    if (
      (tipoFormulario === "nota_comercial" || tipoFormulario === "nota_reclamo" ||
       tipoFormulario === "visita_seguimiento" || tipoFormulario === "reunion") &&
      !receptorNombre.trim()
    ) {
      toast.error("Ingresá el nombre de quien recibió la nota / estuvo presente");
      return;
    }

    setGuardando(true);

    // GPS fresco al guardar visita
    let coordenadas = gps;
    if (tipo === "visita") {
      setGpsEstado("buscando");
      const fresh = await capturarGPSPromise();
      if (fresh) {
        coordenadas = fresh;
        setGps(fresh);
        setGpsEstado("ok");
      } else {
        setGpsEstado("error");
        coordenadas = null;
      }
    }

    // Subir foto si hay una
    let fotoUrl: string | null = null;
    if (fotoFile) {
      setSubiendoFoto(true);
      const ext = fotoFile.name.split(".").pop() ?? "jpg";
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("gestiones-fotos")
        .upload(path, fotoFile, { contentType: fotoFile.type, upsert: false });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("gestiones-fotos").getPublicUrl(path);
        fotoUrl = urlData.publicUrl;
      } else {
        toast.error("No se pudo subir la foto — se guardará sin imagen");
      }
      setSubiendoFoto(false);
    }

    // Construir datos_extra según tipo_formulario
    const datosExtra: Record<string, unknown> = {};
    if (
      tipoFormulario === "nota_comercial" || tipoFormulario === "nota_reclamo" ||
      tipoFormulario === "visita_seguimiento" || tipoFormulario === "reunion"
    ) {
      datosExtra.receptor_nombre = receptorNombre.trim();
      datosExtra.receptor_apellido = receptorApellido.trim() || null;
      datosExtra.fecha_entrega = fechaEntrega || null;
      datosExtra.acta_nro = actaNro.trim() || null;
    }
    // Siempre guardar el resultado real y su score
    datosExtra.resultado_real = resultadoReal || null;
    datosExtra.score = resultadoRealObj?.score ?? null;

    const { error } = await supabase.from("gestiones").insert({
      cliente_id: parseInt(clienteSeleccionado.id),
      evento_id: eventoSeleccionado || null,
      ejecutivo_id: user!.id,
      tipo,
      resultado: resultadoSeleccionado?.nombre ?? "",
      resultado_id: resultadoId,
      datos_extra: datosExtra,
      nota: notas || null,
      fecha_inicio: new Date().toISOString(),
      lat_inicio: coordenadas?.lat ?? null,
      lng_inicio: coordenadas?.lng ?? null,
      foto_url: fotoUrl,
    });

    if (error) {
      toast.error("Error al guardar: " + error.message);
      setGuardando(false);
      return;
    }

    // Actualizar ultima_gestion en el cliente
    // auto-agenda 30 días si el resultado lo requiere
    const autoAgenda = resultadoRealObj?.autoAgenda ?? false;
    const proximaFinal = autoAgenda
      ? (() => {
          const d = new Date();
          d.setDate(d.getDate() + 30);
          return d.toISOString().split("T")[0];
        })()
      : proxima || null;

    await supabase.from("clientes").update({
      ultima_gestion: new Date().toISOString(),
      proxima_accion: proximaFinal,
    }).eq("id", clienteSeleccionado.id);

    if (autoAgenda) {
      toast.success("Gestión guardada. Próxima visita agendada en 30 días ✅");
    } else {
      toast.success("Gestión registrada en la bitácora ✅");
    }

    // Limpiar formulario
    setClienteSeleccionado(null);
    setBusqueda("");
    setResultadoId("");
    setNotas("");
    setProxima("");
    setReceptorNombre(""); setReceptorApellido(""); setFechaEntrega(""); setActaNro("");
    setResultadoReal("");
    setResultadosCompletadosCliente(new Set());
    quitarFoto();
    setGuardando(false);
  };

  return (
    <>
      <AppHeader title="Registrar gestión" subtitle="Visita, llamada o mail" />

      <div className="space-y-5 px-4 pt-5 pb-8">

        {/* Tipo de gestión */}
        <div className="grid grid-cols-5 gap-1.5 rounded-2xl border border-border bg-card p-1.5 shadow-card">
          {TIPOS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTipo(t.key)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold uppercase tracking-wide transition-smooth",
                tipo === t.key ? "bg-primary text-primary-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">

          {/* Buscador de cliente */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cliente <span className="text-destructive">*</span>
            </Label>

            <div className="relative">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={cargandoClientes ? "Cargando clientes..." : "Nombre o ID del cliente..."}
                  value={busqueda}
                  disabled={cargandoClientes}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setClienteSeleccionado(null);
                    setMostrarDropdown(true);
                  }}
                  onFocus={() => {
                    if (busqueda && !clienteSeleccionado) setMostrarDropdown(true);
                  }}
                  className={cn(
                    "h-12 w-full rounded-xl border border-input bg-background pl-10 pr-10 text-sm outline-none transition-smooth",
                    "focus:border-primary focus:ring-2 focus:ring-primary/20",
                    clienteSeleccionado && "border-success text-foreground font-medium"
                  )}
                />
                {busqueda && (
                  <button
                    type="button"
                    onClick={limpiarCliente}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {mostrarDropdown && clientesFiltrados.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-elevated"
                >
                  {clientesFiltrados.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); seleccionarCliente(c); }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-smooth hover:bg-secondary"
                    >
                      <div className="min-w-0 flex-1">
                        {c.numero_cliente && (
                          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                            ID {String(c.numero_cliente).padStart(4, "0")}
                          </p>
                        )}
                        <p className="truncate text-sm font-semibold">{c.nombre_comercial}</p>
                        {c.ciudad && <p className="truncate text-[11px] text-muted-foreground">{c.ciudad}</p>}
                      </div>
                      {c.instancia && (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                          {c.instancia}
                        </span>
                      )}
                    </button>
                  ))}
                  {clientesFiltrados.length > 8 && (
                    <p className="px-4 py-2.5 text-center text-[11px] text-muted-foreground border-t border-border">
                      {clientesFiltrados.length - 8} más — afinás la búsqueda
                    </p>
                  )}
                </div>
              )}

              {mostrarDropdown && busqueda.length >= 2 && clientesFiltrados.length === 0 && !clienteSeleccionado && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card p-4 text-center shadow-elevated">
                  <p className="text-sm text-muted-foreground">Sin coincidencias para "{busqueda}"</p>
                </div>
              )}
            </div>

            {clienteSeleccionado && clienteSeleccionado.instancia !== "CENSO" && (
              <p className="text-[11px] text-success font-semibold flex items-center gap-1">
                ✓ {clienteSeleccionado.nombre_comercial}
                {clienteSeleccionado.ciudad && ` · ${clienteSeleccionado.ciudad}`}
              </p>
            )}
            {clienteSeleccionado && clienteSeleccionado.instancia === "CENSO" && (
              <p className="text-[11px] text-destructive font-semibold flex items-center gap-1">
                ⚠️ Este cliente está en CENSO — no se puede registrar gestión hasta que pase a COMERCIAL.
              </p>
            )}
          </div>

          {/* Selector de evento — solo para clientes tipo "evento" */}
          {clienteSeleccionado?.tipo_cliente === "evento" && clienteSeleccionado.instancia !== "CENSO" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Evento <span className="text-destructive">*</span>
              </Label>
              {eventosCliente.length === 0 ? (
                <p className="rounded-xl border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-3 text-xs text-amber-700 dark:text-amber-400 font-semibold">
                  ⚠️ Este venue no tiene eventos activos. Creá uno desde la ficha del cliente.
                </p>
              ) : (
                <select
                  value={eventoSeleccionado}
                  onChange={(e) => setEventoSeleccionado(e.target.value)}
                  className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="">Seleccioná el evento...</option>
                  {eventosCliente.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      EV-{String(ev.numero_evento).padStart(3, "0")} — {ev.nombre_evento ?? "Sin nombre"}
                      {ev.fecha_evento ? ` · ${new Date(ev.fecha_evento + "T00:00:00").toLocaleDateString("es-PY", { day: "2-digit", month: "short" })}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Tarea */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Tarea <span className="text-destructive">*</span>
            </Label>
            {cargandoResultados ? (
              <div className="flex items-center gap-2 h-12 px-3 rounded-xl border border-input bg-background text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Cargando tareas...</span>
              </div>
            ) : (
              <select
                value={resultadoId}
                onChange={(e) => handleResultadoChange(e.target.value)}
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Seleccioná la tarea realizada...</option>
                {tiposResultadoFiltrados.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            )}
          </div>

          {/* ── Formulario especial: Nota / Visita Seguimiento / Reunión (con receptor) ── */}
          {(tipoFormulario === "nota_comercial" || tipoFormulario === "nota_reclamo" ||
            tipoFormulario === "visita_seguimiento" || tipoFormulario === "reunion") && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                📄 {resultadoSeleccionado?.nombre ?? "Datos del receptor"}
              </p>
              <p className="text-[11px] text-muted-foreground">Datos de quien recibió / estuvo presente.</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                    Nombre <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Nombre"
                    value={receptorNombre}
                    onChange={(e) => setReceptorNombre(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Apellido</Label>
                  <Input
                    placeholder="Apellido"
                    value={receptorApellido}
                    onChange={(e) => setReceptorApellido(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Fecha</Label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="date"
                      value={fechaEntrega}
                      onChange={(e) => setFechaEntrega(e.target.value)}
                      className="h-10 pl-10 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Acta Nro.</Label>
                  <Input
                    placeholder="Nº de acta"
                    value={actaNro}
                    onChange={(e) => setActaNro(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Bloque RESULTADO — aparece cuando se seleccionó una Tarea ── */}
          {resultadoId && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Resultado <span className="text-destructive">*</span>
                </p>
              </div>
              <select
                value={resultadoReal}
                onChange={(e) => setResultadoReal(e.target.value)}
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">¿Cuál fue el resultado?</option>
                {RESULTADOS_GESTION.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
              {resultadoRealObj?.autoAgenda && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                    Se agendará revisita automáticamente en 30 días.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Notas / Resumen */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notas / Resumen</Label>
            <Textarea
              placeholder="Puntos clave conversados, acuerdos, observaciones..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Próxima acción — oculta si el resultado auto-agenda */}
          {!resultadoRealObj?.autoAgenda && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Próxima acción</Label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={proxima}
                  onChange={(e) => setProxima(e.target.value)}
                  className="h-12 pl-10"
                />
              </div>
            </div>
          )}
        </div>

        {/* Evidencia de visita */}
        {tipo === "visita" && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Evidencia de visita</p>
            <div className="mt-3 grid grid-cols-2 gap-2">

              {/* GPS automático */}
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3",
                  gpsEstado === "ok"
                    ? "border-success/40 bg-success/5"
                    : gpsEstado === "error"
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-dashed border-border bg-secondary/40"
                )}
              >
                {gpsEstado === "buscando" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-[11px] font-semibold text-muted-foreground">Obteniendo ubicación...</span>
                  </>
                ) : gpsEstado === "ok" && gps ? (
                  <>
                    <MapPin className="h-5 w-5 text-success" />
                    <span className="text-[11px] font-semibold text-success">Ubicación captada ✓</span>
                    <span className="text-[10px] text-muted-foreground text-center">
                      {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                    </span>
                  </>
                ) : gpsEstado === "error" ? (
                  <>
                    <MapPin className="h-5 w-5 text-destructive" />
                    <span className="text-[11px] font-semibold text-destructive">Sin acceso GPS</span>
                    <span className="text-[10px] text-muted-foreground text-center">Habilitá la ubicación</span>
                  </>
                ) : (
                  <>
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[11px] font-semibold text-muted-foreground">GPS pendiente</span>
                  </>
                )}
              </div>

              {/* Foto */}
              <div>
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={seleccionarFoto}
                />
                {fotoPreview ? (
                  <div className="relative h-full min-h-[88px] overflow-hidden rounded-xl border border-success/40">
                    <img
                      src={fotoPreview}
                      alt="Foto de visita"
                      className="h-full w-full object-cover"
                      style={{ minHeight: 88 }}
                    />
                    <button
                      type="button"
                      onClick={quitarFoto}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <span className="absolute bottom-1 left-1.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      ✓ Foto lista
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fotoInputRef.current?.click()}
                    className="flex h-full min-h-[88px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-secondary/40 p-3 text-muted-foreground transition-smooth hover:border-primary/40 hover:text-primary"
                  >
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[11px] font-semibold">Sacar foto</span>
                    <span className="text-[10px]">Evidencia de visita</span>
                  </button>
                )}
              </div>
            </div>

            {gpsEstado === "error" && (
              <p className="mt-2.5 text-[11px] text-destructive font-semibold">
                ⚠️ La visita se guardará sin coordenadas. El sistema registrará el intento fallido.
              </p>
            )}
          </div>
        )}

        <Button
          onClick={guardar}
          disabled={guardando || subiendoFoto || !clienteSeleccionado || !resultadoId || clienteSeleccionado?.instancia === "CENSO"}
          className="h-13 w-full gap-2 text-base font-semibold"
        >
          <Loader2 className={cn("h-5 w-5 animate-spin", !guardando && !subiendoFoto && "hidden")} />
          <Save className={cn("h-5 w-5", (guardando || subiendoFoto) && "hidden")} />
          {subiendoFoto ? "Subiendo foto..." : guardando ? "Guardando..." : "Guardar en bitácora"}
        </Button>
      </div>
    </>
  );
};

export default Registrar;
