import { useEffect, useRef, useState } from "react";
import { Camera, MapPin, Phone, Car, Save, Calendar, Mail, Search, X, Loader2, MessageCircle, FileText, ImagePlus, Trash2 } from "lucide-react";
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
}

const TIPOS = [
  { key: "visita",   label: "Visita",    icon: Car },
  { key: "llamada",  label: "Llamada",   icon: Phone },
  { key: "email",    label: "Email",     icon: Mail },
  { key: "whatsapp", label: "WhatsApp",  icon: MessageCircle },
  { key: "otro",     label: "Otro",      icon: FileText },
];

const RESULTADOS = [
  { key: "atendido",     label: "✅ Atendido" },
  { key: "comprometido", label: "🤝 Comprometido" },
  { key: "proxima_cita", label: "📅 Próxima cita" },
  { key: "no_atendido",  label: "📵 No atendido" },
  { key: "rechazo",      label: "❌ Rechazo" },
  { key: "pago",         label: "💰 Pagó" },
  { key: "sin_resultado",label: "➖ Sin resultado" },
];

const Registrar = () => {
  const { user } = useAuth();
  const { canManage, nombreCompleto } = useProfile();

  // Clientes disponibles
  const [clientes, setClientes] = useState<ClienteOpcion[]>([]);
  const [cargandoClientes, setCargandoClientes] = useState(true);

  // Buscador
  const [busqueda, setBusqueda] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteOpcion | null>(null);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Formulario
  const [tipo, setTipo] = useState("visita");
  const [resultado, setResultado] = useState("");
  const [notas, setNotas] = useState("");
  const [proxima, setProxima] = useState("");
  const [guardando, setGuardando] = useState(false);

  // GPS — captura automática, sin acción manual del ejecutivo
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsEstado, setGpsEstado] = useState<"idle" | "buscando" | "ok" | "error">("idle");

  // Foto
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  // Promesa de GPS reutilizable (usada al cambiar tipo y al guardar)
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
  }, [user, canManage]);

  const cargarClientes = async () => {
    setCargandoClientes(true);
    let query = supabase
      .from("clientes")
      .select("id, numero_cliente, nombre_comercial, ciudad, instancia")
      .eq("activo", true)
      .order("nombre_comercial");

    if (!canManage) {
      query = query.eq("ejecutivo_id", user!.id);
    }

    const { data } = await query;
    setClientes(data ?? []);
    setCargandoClientes(false);
  };

  // Filtrar por texto escrito o por ID numérico
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

  const seleccionarCliente = (c: ClienteOpcion) => {
    setClienteSeleccionado(c);
    setBusqueda(c.nombre_comercial);
    setMostrarDropdown(false);
    inputRef.current?.blur();
  };

  const limpiarCliente = () => {
    setClienteSeleccionado(null);
    setBusqueda("");
    setMostrarDropdown(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Cerrar dropdown al hacer clic afuera
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

  // Aplica una barra con nombre, fecha y hora en la parte inferior de la foto
  const aplicarMarcaDeAgua = (file: File, nombre: string): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;

        // Dibujar la imagen original
        ctx.drawImage(img, 0, 0);

        // Texto de la marca
        const ahora = new Date();
        const fecha = ahora.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
        const hora = ahora.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const linea1 = nombre.toUpperCase();
        const linea2 = `${fecha}  •  ${hora}  •  SGP Paraguay`;

        const fontSize = Math.max(Math.round(img.width * 0.038), 22);
        const smallSize = Math.round(fontSize * 0.72);
        const padding = Math.round(fontSize * 0.7);
        const barHeight = fontSize + smallSize + padding * 2.5;

        // Barra oscura translúcida
        ctx.fillStyle = "rgba(0, 0, 0, 0.70)";
        ctx.fillRect(0, img.height - barHeight, img.width, barHeight);

        // Línea de color SGP arriba de la barra
        ctx.fillStyle = "#3b82f6"; // azul primario
        ctx.fillRect(0, img.height - barHeight, img.width, Math.round(fontSize * 0.18));

        // Nombre del ejecutivo (grande)
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        ctx.fillText(linea1, padding, img.height - barHeight + padding);

        // Fecha, hora y marca SGP (pequeño)
        ctx.font = `${smallSize}px Arial, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillText(linea2, padding, img.height - barHeight + padding + fontSize + Math.round(smallSize * 0.3));

        URL.revokeObjectURL(objectUrl);

        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            const nuevoArchivo = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, ".jpg"),
              { type: "image/jpeg" }
            );
            resolve(nuevoArchivo);
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

    // Aplicar marca de agua inmediatamente — lo que se ve en preview es lo que se sube
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
    if (!resultado) { toast.error("Seleccioná el resultado de la gestión"); return; }

    setGuardando(true);

    // Para visitas: recapturar GPS fresco en el momento exacto del guardado
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
        // Guardamos igual pero sin coordenadas — se registra el intento fallido
        coordenadas = null;
      }
    }

    // Subir foto si hay una seleccionada
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

    const { error } = await supabase.from("gestiones").insert({
      cliente_id: parseInt(clienteSeleccionado.id),
      ejecutivo_id: user!.id,
      tipo,
      resultado,
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

    // Actualizar ultima_gestion y proxima_accion en el cliente
    await supabase.from("clientes").update({
      ultima_gestion: new Date().toISOString(),
      proxima_accion: proxima || null,
    }).eq("id", clienteSeleccionado.id);

    toast.success("Gestión registrada en la bitácora ✅");
    setClienteSeleccionado(null);
    setBusqueda("");
    setResultado("");
    setNotas("");
    setProxima("");
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
              {/* Input de búsqueda */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={cargandoClientes ? "Cargando clientes..." : "Escribí el nombre del cliente..."}
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

              {/* Dropdown de resultados */}
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

              {/* Sin resultados */}
              {mostrarDropdown && busqueda.length >= 2 && clientesFiltrados.length === 0 && !clienteSeleccionado && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card p-4 text-center shadow-elevated">
                  <p className="text-sm text-muted-foreground">Sin coincidencias para "{busqueda}"</p>
                </div>
              )}
            </div>

            {/* Cliente seleccionado — confirmación o advertencia CENSO */}
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

          {/* Resultado */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Resultado <span className="text-destructive">*</span>
            </Label>
            <select
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">¿Cómo fue la gestión?</option>
              {RESULTADOS.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notas</Label>
            <Textarea
              placeholder="Detalles de la gestión, acuerdos, observaciones..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Próxima acción */}
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
        </div>

        {/* Evidencia de visita — solo lectura, GPS automático */}
        {tipo === "visita" && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Evidencia de visita</p>
            <div className="mt-3 grid grid-cols-2 gap-2">

              {/* GPS — indicador automático, sin acción manual */}
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
                    <span className="text-[10px] text-muted-foreground text-center">Habilitá la ubicación en tu dispositivo</span>
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
                ⚠️ La visita se guardará sin coordenadas. El sistema registrará el intento de geolocalización fallido.
              </p>
            )}
          </div>
        )}

        <Button
          onClick={guardar}
          disabled={guardando || subiendoFoto || !clienteSeleccionado || !resultado || clienteSeleccionado?.instancia === "CENSO"}
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
