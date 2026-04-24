import { useEffect, useRef, useState } from "react";
import { Camera, MapPin, Phone, Car, Save, Calendar, Mail, Search, X, Loader2, MessageCircle, FileText } from "lucide-react";
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
  const { isAdmin } = useProfile();

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

  useEffect(() => {
    if (!user) return;
    cargarClientes();
  }, [user, isAdmin]);

  const cargarClientes = async () => {
    setCargandoClientes(true);
    let query = supabase
      .from("clientes")
      .select("id, nombre_comercial, ciudad, instancia")
      .eq("activo", true)
      .order("nombre_comercial");

    if (!isAdmin) {
      query = query.eq("ejecutivo_id", user!.id);
    }

    const { data } = await query;
    setClientes(data ?? []);
    setCargandoClientes(false);
  };

  // Filtrar por texto escrito
  const clientesFiltrados = clientes.filter((c) => {
    if (!busqueda) return false;
    const q = busqueda.toLowerCase();
    return (
      c.nombre_comercial.toLowerCase().includes(q) ||
      (c.ciudad ?? "").toLowerCase().includes(q)
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

  const guardar = async () => {
    if (!clienteSeleccionado) { toast.error("Seleccioná un cliente"); return; }
    if (!resultado) { toast.error("Seleccioná el resultado de la gestión"); return; }

    setGuardando(true);

    const { error } = await supabase.from("gestiones").insert({
      cliente_id: parseInt(clienteSeleccionado.id),
      ejecutivo_id: user!.id,
      tipo,
      resultado,
      nota: notas || null,
      fecha_inicio: new Date().toISOString(),
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

        {/* GPS / Foto (solo en visitas) */}
        {tipo === "visita" && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Evidencia</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-3">
                <div className="flex items-center gap-2 text-success">
                  <MapPin className="h-4 w-4" />
                  <span className="text-xs font-semibold">GPS captado</span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">-25.2867, -57.6542</p>
              </div>
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-secondary/40 p-3 text-muted-foreground transition-smooth hover:border-primary/40 hover:text-primary"
              >
                <Camera className="h-5 w-5" />
                <span className="text-[11px] font-semibold">Adjuntar foto</span>
              </button>
            </div>
          </div>
        )}

        <Button onClick={guardar} disabled={guardando || !clienteSeleccionado || !resultado || clienteSeleccionado?.instancia === "CENSO"} className="h-13 w-full gap-2 text-base font-semibold">
          {guardando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {guardando ? "Guardando..." : "Guardar en bitácora"}
        </Button>
      </div>
    </>
  );
};

export default Registrar;
