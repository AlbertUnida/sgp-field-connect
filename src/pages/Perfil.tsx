import { useEffect, useState } from "react";
import { User, Lock, LogOut, Save, Eye, EyeOff, Loader2, Shield, UserCheck, ChevronDown, ChevronUp } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ROL_LABELS: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  admin:      { label: "Administrador", color: "text-destructive",  icon: Shield },
  supervisor: { label: "Supervisor",    color: "text-warning",      icon: UserCheck },
  ejecutivo:  { label: "Ejecutivo",     color: "text-primary",      icon: User },
};

const Perfil = () => {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  // ── Datos personales ──
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [guardandoDatos, setGuardandoDatos] = useState(false);

  // ── Secciones colapsables ──
  const [showDatosSection, setShowDatosSection] = useState(true);
  const [showPassSection, setShowPassSection] = useState(false);
  const [nuevaPass, setNuevaPass] = useState("");
  const [confirmarPass, setConfirmarPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [guardandoPass, setGuardandoPass] = useState(false);

  // ── Confirmación logout ──
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    if (profile) {
      setNombre(profile.nombre ?? "");
      setApellido(profile.apellido ?? "");
      setTelefono(profile.telefono ?? "");
    }
  }, [profile]);

  const guardarDatos = async () => {
    if (!nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    setGuardandoDatos(true);
    const { error, count } = await supabase
      .from("profiles")
      .update({
        nombre: nombre.trim(),
        apellido: apellido.trim() || null,
        telefono: telefono.trim() || null,
      }, { count: "exact" })
      .eq("id", user!.id);

    if (error) { toast.error("Error: " + error.message); }
    else if (count === 0) { toast.error("No se pudo guardar. Intentá nuevamente."); }
    else { toast.success("Datos actualizados ✅"); }
    setGuardandoDatos(false);
  };

  const cambiarPassword = async () => {
    if (!nuevaPass) { toast.error("Ingresá la nueva contraseña"); return; }
    if (nuevaPass.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    if (nuevaPass !== confirmarPass) { toast.error("Las contraseñas no coinciden"); return; }
    setGuardandoPass(true);
    const { error } = await supabase.auth.updateUser({ password: nuevaPass });
    if (error) { toast.error("Error: " + error.message); }
    else {
      toast.success("Contraseña actualizada ✅");
      setNuevaPass("");
      setConfirmarPass("");
      setShowPassSection(false);
    }
    setGuardandoPass(false);
  };

  const cerrarSesion = async () => {
    await signOut();
    toast.success("Sesión cerrada");
  };

  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rolInfo = ROL_LABELS[profile?.rol ?? "ejecutivo"] ?? ROL_LABELS.ejecutivo;
  const RolIcon = rolInfo.icon;
  const iniciales = [nombre, apellido]
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <>
      <AppHeader title="Mi Perfil" />

      <div className="px-4 pt-5 pb-10 space-y-4">

        {/* ── Tarjeta de identidad + logout ── */}
        <section className="rounded-2xl gradient-primary p-5 text-primary-foreground shadow-elevated">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent/20 text-accent text-2xl font-bold">
              {iniciales}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold leading-tight truncate">
                {[nombre, apellido].filter(Boolean).join(" ") || "Sin nombre"}
              </p>
              <p className="mt-0.5 text-xs text-primary-foreground/70 truncate">{user?.email}</p>
              <span className={cn("mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold uppercase", rolInfo.color)}>
                <RolIcon className="h-3 w-3" />
                {rolInfo.label}
              </span>
            </div>
          </div>

          {/* Botón cerrar sesión — visible siempre, dentro de la tarjeta */}
          <div className="mt-4 border-t border-white/20 pt-4">
            {!confirmLogout ? (
              <button
                onClick={() => setConfirmLogout(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-white/20 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-center text-xs text-primary-foreground/80">¿Confirmás que querés salir?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmLogout(false)}
                    className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-white/20 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={cerrarSesion}
                    className="flex-1 rounded-xl bg-red-500/80 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-500 transition-colors"
                  >
                    Sí, salir
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Datos personales (colapsable) ── */}
        <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <button
            onClick={() => setShowDatosSection((v) => !v)}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">Datos personales</span>
            </div>
            {showDatosSection
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
            }
          </button>

          {showDatosSection && (
            <div className="border-t border-border px-4 pb-4 pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre <span className="text-destructive">*</span></Label>
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Apellido</Label>
                <Input
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  placeholder="Tu apellido"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+595 981 123-456"
                  type="tel"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-muted-foreground">Email (no editable)</Label>
                <Input value={user?.email ?? ""} disabled className="h-11 opacity-60" />
              </div>

              <Button
                onClick={guardarDatos}
                disabled={guardandoDatos}
                className="w-full h-11 gap-2"
              >
                {guardandoDatos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {guardandoDatos ? "Guardando..." : "Guardar datos"}
              </Button>
            </div>
          )}
        </section>

        {/* ── Cambiar contraseña (colapsable) ── */}
        <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          {/* Cabecera — siempre visible, hace toggle */}
          <button
            onClick={() => {
              setShowPassSection((v) => !v);
              if (showPassSection) { setNuevaPass(""); setConfirmarPass(""); }
            }}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">Cambiar contraseña</span>
            </div>
            {showPassSection
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
            }
          </button>

          {/* Formulario — colapsable */}
          {showPassSection && (
            <div className="border-t border-border px-4 pb-4 pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    value={nuevaPass}
                    onChange={(e) => setNuevaPass(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="h-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Confirmar contraseña</Label>
                <Input
                  type={showPass ? "text" : "password"}
                  value={confirmarPass}
                  onChange={(e) => setConfirmarPass(e.target.value)}
                  placeholder="Repetí la contraseña"
                  className="h-11"
                />
              </div>

              <Button
                onClick={cambiarPassword}
                disabled={guardandoPass}
                variant="outline"
                className="w-full h-11 gap-2"
              >
                {guardandoPass ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                {guardandoPass ? "Actualizando..." : "Actualizar contraseña"}
              </Button>
            </div>
          )}
        </section>

      </div>
    </>
  );
};

export default Perfil;
