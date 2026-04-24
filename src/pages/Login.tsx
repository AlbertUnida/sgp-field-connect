import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Music2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Ingresá email y contraseña");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Email o contraseña incorrectos");
      } else if (error.message.includes("Email not confirmed")) {
        toast.error("Confirmá tu email antes de ingresar");
      } else {
        toast.error("Error al ingresar. Intentá de nuevo.");
      }
      setLoading(false);
      return;
    }

    toast.success("¡Bienvenido a SGP Campo!");
    navigate("/app");
  };

  return (
    <div className="relative flex min-h-screen flex-col gradient-hero text-primary-foreground">
      {/* decorativo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-primary-glow/40 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-14">
        {/* Marca */}
        <div className="mb-12 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-accent shadow-accent">
              <Music2 className="h-6 w-6 text-accent-foreground" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">SGP Paraguay</p>
              <h1 className="text-2xl font-bold leading-tight">Campo</h1>
            </div>
          </div>
          <p className="mt-6 text-sm text-primary-foreground/70 text-balance">
            Gestión comercial de licencias musicales para ejecutivos de campo.
          </p>
        </div>

        {/* Formulario */}
        <form
          onSubmit={handleSubmit}
          className="animate-scale-in rounded-3xl bg-card p-6 text-card-foreground shadow-elevated"
        >
          <h2 className="text-xl font-bold">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-muted-foreground">Accedé con tu cuenta corporativa SGP.</p>

          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="ejecutivo@sgp.org.py"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                  ¿Olvidaste?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pr-12"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="mt-6 h-12 w-full gap-2 text-base font-semibold"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Ingresando...
              </>
            ) : (
              <>
                Ingresar <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <p className="mt-auto py-8 text-center text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} SGP · Sociedad de Gestión de Productores Fonográficos del Paraguay
        </p>
      </div>
    </div>
  );
};

export default Login;
