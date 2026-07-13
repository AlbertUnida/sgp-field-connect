import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Loader2, Wallet, CalendarClock } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { useProfile } from "@/hooks/useProfile";
import { formatPYG } from "@/lib/format";
import { toast } from "sonner";

interface ClienteCobranza {
  id: number;
  nombre_comercial: string;
  ciudad: string | null;
  tarifa_mensual: number | null;
  fecha_vencimiento: string | null;
}

interface EjecutivoCobranza {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string;
}

/**
 * Asignación de clientes en COBRANZAS sin ejecutivo a un ejecutivo del área
 * cobranzas. Análogo al panel CENSO→COMERCIAL, pero para la cartera de cobranzas.
 * Acceso: admin y supervisores (canManage).
 */
const AsignarCobranzas = () => {
  const { canManage, loading: profileLoading } = useProfile();
  const navigate = useNavigate();

  const [clientes, setClientes] = useState<ClienteCobranza[]>([]);
  const [ejecutivos, setEjecutivos] = useState<EjecutivoCobranza[]>([]);
  const [asignaciones, setAsignaciones] = useState<Record<number, string>>({});
  const [asignando, setAsignando] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileLoading && !canManage) navigate("/app");
  }, [canManage, profileLoading, navigate]);

  const cargar = async () => {
    setLoading(true);
    const [{ data: cls }, { data: ejes }] = await Promise.all([
      supabase
        .from("clientes")
        .select("id, nombre_comercial, ciudad, tarifa_mensual, fecha_vencimiento")
        .eq("instancia", "COBRANZAS")
        .is("ejecutivo_id", null)
        .order("fecha_vencimiento", { ascending: true, nullsFirst: false }),
      supabase
        .from("profiles")
        .select("id, nombre, apellido, email")
        .eq("area", "cobranzas")
        .eq("activo", true)
        .order("nombre"),
    ]);
    setClientes((cls as ClienteCobranza[]) ?? []);
    setEjecutivos((ejes as EjecutivoCobranza[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (canManage) cargar();
  }, [canManage]);

  const asignar = async (clienteId: number) => {
    const ejecutivoId = asignaciones[clienteId];
    if (!ejecutivoId) { toast.error("Seleccioná un ejecutivo de cobranzas"); return; }
    setAsignando(clienteId);
    const { error } = await supabase
      .from("clientes")
      .update({ ejecutivo_id: ejecutivoId })
      .eq("id", clienteId);
    if (error) { toast.error("Error: " + error.message); setAsignando(null); return; }
    toast.success("Cliente asignado a cobranzas ✅");
    await cargar();
    setAsignando(null);
  };

  return (
    <>
      <AppHeader title="Asignar cobranzas" subtitle="Clientes en COBRANZAS sin ejecutivo" />

      <div className="px-4 pt-4 pb-8 space-y-4">
        {loading ? (
          <div className="flex justify-center pt-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : ejecutivos.length === 0 ? (
          <div className="rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm text-warning">
            No hay ejecutivos con área <strong>cobranzas</strong>. Creá al menos uno desde Admin → Equipo (Rol Ejecutivo, Área Cobranzas) antes de asignar.
          </div>
        ) : clientes.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No hay clientes de cobranzas sin asignar. 🎉
          </div>
        ) : (
          <div className="space-y-3">
            {clientes.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate">{c.nombre_comercial}</p>
                    {c.ciudad && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />{c.ciudad}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {c.tarifa_mensual != null && (
                      <p className="text-sm font-bold text-primary">{formatPYG(c.tarifa_mensual)}</p>
                    )}
                    {c.fecha_vencimiento && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 justify-end">
                        <CalendarClock className="h-3 w-3" />
                        {new Date(c.fecha_vencimiento + "T00:00:00").toLocaleDateString("es-PY", { day: "2-digit", month: "short" })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <select
                    value={asignaciones[c.id] ?? ""}
                    onChange={(e) => setAsignaciones((p) => ({ ...p, [c.id]: e.target.value }))}
                    className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Seleccioná ejecutivo...</option>
                    {ejecutivos.map((e) => (
                      <option key={e.id} value={e.id}>
                        {[e.nombre, e.apellido].filter(Boolean).join(" ") || e.email}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    onClick={() => asignar(c.id)}
                    disabled={!asignaciones[c.id] || asignando === c.id}
                    className="h-10 px-3 shrink-0 gap-1"
                  >
                    {asignando === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Wallet className="h-3.5 w-3.5" /> Asignar</>}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default AsignarCobranzas;
