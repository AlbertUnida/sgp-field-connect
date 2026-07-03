import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, KeyRound, Eye, EyeOff } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();

  const [listo, setListo] = useState(false);        // sesión de recovery detectada
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase convierte el hash de la URL en un evento PASSWORD_RECOVERY
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setListo(true);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setGuardando(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setGuardando(false);

    if (err) {
      setError(err.message);
      return;
    }

    toast.success("✅ Contraseña actualizada. Iniciá sesión.");
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center gradient-hero px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-elevated">

        {/* Logo / ícono */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-md">
            <KeyRound className="h-8 w-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold">Nueva contraseña</h1>
            <p className="mt-1 text-sm text-muted-foreground">SGP Field Connect</p>
          </div>
        </div>

        {!listo ? (
          /* Esperando el evento PASSWORD_RECOVERY de Supabase */
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verificando enlace de recuperación...</p>
            <p className="text-xs text-muted-foreground">
              Si este mensaje no desaparece, el enlace puede haber expirado.{" "}
              <button
                onClick={() => navigate("/forgot-password")}
                className="font-semibold text-primary underline underline-offset-2"
              >
                Solicitá uno nuevo.
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Nueva contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={verPass ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setVerPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {verPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmar">Confirmá la contraseña</Label>
              <Input
                id="confirmar"
                type={verPass ? "text" : "password"}
                placeholder="Repetí la contraseña"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={guardando || !password || !confirmar}
              className="w-full h-11 gap-2"
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {guardando ? "Guardando..." : "Actualizar contraseña"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
