import { useState } from "react";
import { Camera, MapPin, Phone, Car, Save, Calendar } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MOCK_CLIENTES } from "@/lib/mock-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Registrar = () => {
  const [tipo, setTipo] = useState<"visita" | "llamada">("visita");
  const [cliente, setCliente] = useState("");
  const [resultado, setResultado] = useState("");
  const [notas, setNotas] = useState("");
  const [proxima, setProxima] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente || !resultado) {
      toast.error("Completá cliente y resultado");
      return;
    }
    toast.success(`${tipo === "visita" ? "Visita" : "Llamada"} registrada con éxito`);
    setCliente("");
    setResultado("");
    setNotas("");
    setProxima("");
  };

  return (
    <>
      <AppHeader title="Registrar gestión" subtitle="Visita o llamada al cliente" />

      <form onSubmit={handleSubmit} className="space-y-5 px-4 pt-5 pb-6">
        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-card">
          <TypeBtn active={tipo === "visita"} onClick={() => setTipo("visita")} icon={<Car className="h-4 w-4" />}>
            Visita
          </TypeBtn>
          <TypeBtn active={tipo === "llamada"} onClick={() => setTipo("llamada")} icon={<Phone className="h-4 w-4" />}>
            Llamada
          </TypeBtn>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
          {/* Cliente */}
          <div className="space-y-1.5">
            <Label htmlFor="cliente">Cliente</Label>
            <Select value={cliente} onValueChange={setCliente}>
              <SelectTrigger id="cliente" className="h-12">
                <SelectValue placeholder="Seleccioná un cliente..." />
              </SelectTrigger>
              <SelectContent>
                {MOCK_CLIENTES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre} · {c.ciudad}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resultado */}
          <div className="space-y-1.5">
            <Label htmlFor="resultado">Resultado</Label>
            <Select value={resultado} onValueChange={setResultado}>
              <SelectTrigger id="resultado" className="h-12">
                <SelectValue placeholder="¿Cómo fue la gestión?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exitosa">✅ Exitosa</SelectItem>
                <SelectItem value="reagendada">🔁 Reagendada</SelectItem>
                <SelectItem value="sin_respuesta">❌ Sin respuesta</SelectItem>
                <SelectItem value="cerrada">🎯 Cerrada / firmada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              placeholder="Detalles de la gestión, próximos pasos, observaciones..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Próxima acción */}
          <div className="space-y-1.5">
            <Label htmlFor="proxima">Próxima acción</Label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="proxima"
                type="date"
                value={proxima}
                onChange={(e) => setProxima(e.target.value)}
                className="h-12 pl-10"
              />
            </div>
          </div>
        </div>

        {/* GPS / Photo evidence (only for visit) */}
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

        <Button type="submit" className="h-12 w-full gap-2 text-base font-semibold gradient-accent text-accent-foreground hover:opacity-90 shadow-accent">
          <Save className="h-4 w-4" />
          Guardar gestión
        </Button>
      </form>
    </>
  );
};

const TypeBtn = ({
  active, onClick, icon, children,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold uppercase tracking-wide transition-smooth",
      active ? "bg-primary text-primary-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
    )}
  >
    {icon}
    {children}
  </button>
);

export default Registrar;
