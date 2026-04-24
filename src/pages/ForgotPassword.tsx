import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error("Error al enviar el correo. Intentá de nuevo.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen gradient-hero text-primary-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pt-6">
        <Link to="/" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/15">
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="mt-10 animate-fade-in">
          <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
          <p className="mt-2 text-sm text-primary-foreground/70 text-balance">
            Ingresá tu email corporativo y te enviaremos un enlace para restablecer tu contraseña.
          </p>
        </div>

        <div className="mt-8 animate-scale-in rounded-3xl bg-card p-6 text-card-foreground shadow-elevated">
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    placeholder="ejecutivo@sgp.org.py"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 pl-10"
                    disabled={loading}
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="h-12 w-full text-base font-semibold">
                {loading ? "Enviando..." : "Enviar enlace"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h2 className="font-semibold">Revisá tu correo</h2>
                <p className="mt-1 text-sm text-muted-foreground text-balance">
                  Si <strong className="text-foreground">{email}</strong> está registrado, recibirás un enlace en los próximos minutos.
                </p>
              </div>
              <Button asChild variant="outline" className="h-11 w-full">
                <Link to="/">Volver al inicio</Link>
              </Button>
            </div>
          )}
        </div>

        <p className="mt-auto py-8 text-center text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} SGP Paraguay
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
