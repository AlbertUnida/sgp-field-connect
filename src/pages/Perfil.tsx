import { useEffect, useState, useCallback } from "react";
import {
  User, Lock, LogOut, Save, Eye, EyeOff, Loader2,
  Shield, UserCheck, ChevronDown, ChevronUp, ShieldCheck, ShieldOff, QrCode,
} from "lucide-react";
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

  // ── MFA / 2FA ──
  const [showMfaSection, setShowMfaSection] = useState(false);
  const [loadingMfa, setLoadingMfa] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null); // null = no enrollado
  const [enrollStep, setEnrollStep] = useState<"idle" | "qr" | "confirm">("idle");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [pendingFactorId, setPendingFactorId] = useState("");
  const [enrollCode, setEnrollCode] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // ── Confirmación logout ──
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    if (profile) {
      setNombre(profile.nombre ?? "");
      setApellido(profile.apellido ?? "");
      setTelefono(profile.telefono ?? "");
    }
  }, [profile]);

  // Cargar estado MFA al abrir la sección
  const loadMfaStatus = useCallback(async () => {
    setLoadingMfa(true);
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp?.find((f) => f.status === "verified");
    setMfaFactorId(verified?.id ?? null);
    setLoadingMfa(false);
  }, []);

  useEffect(() => {
    if (showMfaSection) loadMfaStatus();
  }, [showMfaSection, loadMfaStatus]);

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

  // ── MFA: iniciar enrollment ──
  const iniciarEnrollment = async () => {
    setLoadingMfa(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "SGP Campo", friendlyName: "SGP Campo" });
    if (error || !data) {
      toast.error("Error al iniciar 2FA: " + error?.message);
      setLoadingMfa(false);
      return;
    }
    setQrCodeUrl(data.totp.qr_code);
    setMfaSecret(data.totp.secret);
    setPendingFactorId(data.id);
    setEnrollStep("qr");
    setLoadingMfa(false);
  };

  // ── MFA: confirmar código ──
  const confirmarEnrollment = async () => {
    if (enrollCode.length !== 6) { toast.error("El código tiene 6 dígitos"); return; }
    setVerifyingCode(true);

    // Crear challenge primero
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: pendingFactorId,
    });
    if (challengeError || !challenge) {
      toast.error("Error al verificar: " + challengeError?.message);
      setVerifyingCode(false);
      return;
    }

    const { error } = await supabase.auth.mfa.verify({
      factorId: pendingFactorId,
      challengeId: challenge.id,
      code: enrollCode.trim(),
    });

    if (error) {
      toast.error("Código incorrecto. Verificá tu app autenticadora.");
      setEnrollCode("");
      setVerifyingCode(false);
      return;
    }

    toast.success("¡2FA activado correctamente! 🔐");
    setMfaFactorId(pendingFactorId);
    setEnrollStep("idle");
    setEnrollCode("");
    setQrCodeUrl("");
    setMfaSecret("");
    setVerifyingCode(false);
  };

  // ── MFA: desactivar ──
  const desactivarMfa = async () => {
    if (!mfaFactorId) return;
    setUnenrolling(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
    if (error) {
      toast.error("Error al desactivar 2FA: " + error.message);
    } else {
      toast.success("2FA desactivado");
      setMfaFactorId(null);
    }
    setUnenrolling(false);
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

          {/* Botón cerrar sesión */}
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

        {/* ── Autenticación de 2 factores (colapsable) ── */}
        <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <button
            onClick={() => {
              setShowMfaSection((v) => !v);
              if (showMfaSection) {
                setEnrollStep("idle");
                setEnrollCode("");
                setQrCodeUrl("");
              }
            }}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">Autenticación de 2 factores</span>
            </div>
            <div className="flex items-center gap-2">
              {!loadingMfa && mfaFactorId && showMfaSection && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  ACTIVO
                </span>
              )}
              {showMfaSection
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />
              }
            </div>
          </button>

          {showMfaSection && (
            <div className="border-t border-border px-4 pb-5 pt-4 space-y-4">
              {loadingMfa ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (

                /* ── 2FA YA ACTIVADO ── */
                mfaFactorId ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                      <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-800">2FA activado</p>
                        <p className="text-xs text-emerald-700 mt-0.5">Tu cuenta está protegida con autenticación de dos factores.</p>
                      </div>
                    </div>
                    <Button
                      onClick={desactivarMfa}
                      disabled={unenrolling}
                      variant="outline"
                      className="w-full h-11 gap-2 border-destructive/40 text-destructive hover:bg-destructive/5"
                    >
                      {unenrolling
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <ShieldOff className="h-4 w-4" />
                      }
                      {unenrolling ? "Desactivando..." : "Desactivar 2FA"}
                    </Button>
                  </div>
                ) : (

                  /* ── SIN 2FA ── */
                  <>
                    {/* Paso 0: no enrolado aún */}
                    {enrollStep === "idle" && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                          <ShieldOff className="h-5 w-5 text-amber-600 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-amber-800">2FA desactivado</p>
                            <p className="text-xs text-amber-700 mt-0.5">
                              Activá el doble factor para mayor seguridad en tu cuenta.
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={iniciarEnrollment}
                          disabled={loadingMfa}
                          className="w-full h-11 gap-2"
                        >
                          {loadingMfa
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <QrCode className="h-4 w-4" />
                          }
                          Activar 2FA
                        </Button>
                      </div>
                    )}

                    {/* Paso 1: QR code */}
                    {enrollStep === "qr" && qrCodeUrl && (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Escaneá este código con <strong>Google Authenticator</strong>, <strong>Authy</strong>, u otra app autenticadora.
                        </p>
                        <div className="flex justify-center rounded-xl border border-border bg-white p-4">
                          <img src={qrCodeUrl} alt="QR Code 2FA" className="h-48 w-48" />
                        </div>

                        {/* Clave manual */}
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => setShowSecret((v) => !v)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            {showSecret ? "Ocultar clave manual" : "Ver clave manual (sin cámara)"}
                          </button>
                          {showSecret && (
                            <div className="rounded-lg bg-muted px-3 py-2 font-mono text-xs tracking-widest break-all select-all">
                              {mfaSecret}
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={() => setEnrollStep("confirm")}
                          className="w-full h-11 gap-2"
                        >
                          Ya lo escaneé → Ingresar código
                        </Button>
                        <button
                          type="button"
                          onClick={() => { setEnrollStep("idle"); setQrCodeUrl(""); setMfaSecret(""); }}
                          className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}

                    {/* Paso 2: confirmar código */}
                    {enrollStep === "confirm" && (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Ingresá el código de <strong>6 dígitos</strong> que muestra tu app autenticadora para confirmar la activación.
                        </p>
                        <div className="space-y-1.5">
                          <Label>Código de verificación</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            placeholder="000000"
                            value={enrollCode}
                            onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            className="h-14 text-center text-2xl font-mono tracking-[0.5em]"
                            autoFocus
                          />
                        </div>
                        <Button
                          onClick={confirmarEnrollment}
                          disabled={verifyingCode || enrollCode.length !== 6}
                          className="w-full h-11 gap-2"
                        >
                          {verifyingCode
                            ? <><Loader2 className="h-4 w-4 animate-spin" />Verificando...</>
                            : <><ShieldCheck className="h-4 w-4" />Confirmar y activar</>
                          }
                        </Button>
                        <button
                          type="button"
                          onClick={() => setEnrollStep("qr")}
                          className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                        >
                          ← Volver al QR
                        </button>
                      </div>
                    )}
                  </>
                )
              )}
            </div>
          )}
        </section>

      </div>
    </>
  );
};

export default Perfil;
