import { Bell, Wifi, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useOfflineEstado } from "@/hooks/useOfflineSync";
import { useAlertasBadge } from "@/hooks/useAlertasBadge";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /** true en páginas de ancho completo (ej. Monitoreo) */
  wide?: boolean;
}

export const AppHeader = ({ title, subtitle, wide }: AppHeaderProps) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { online, pendientes } = useOfflineEstado();
  const alertas = useAlertasBadge();

  const iniciales = [profile?.nombre, profile?.apellido]
    .filter(Boolean)
    .map((s) => s![0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <header className="sticky top-0 z-30 gradient-hero text-primary-foreground shadow-elevated">
      <div
        className={cn(
          "mx-auto flex items-center justify-between px-4 pt-3 pb-4",
          wide ? "max-w-7xl" : "max-w-md md:max-w-2xl xl:max-w-3xl"
        )}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">SGP Campo</p>
          <h1 className="mt-0.5 text-xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-xs text-primary-foreground/70">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span
            title={online ? "Con conexión" : "Sin conexión — las gestiones se guardan en el teléfono"}
            className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-full bg-white/10",
              online ? "text-success" : "text-destructive"
            )}
          >
            {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {pendientes > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                {pendientes}
              </span>
            )}
          </span>
          <Link
            to="/app/alertas"
            title={alertas > 0 ? `${alertas} alertas vencidas` : "Sin alertas vencidas"}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Bell className="h-4 w-4" />
            {alertas > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                {alertas > 99 ? "99+" : alertas}
              </span>
            )}
          </Link>
          {/* Avatar → navega a perfil */}
          <Link
            to="/app/perfil"
            title={user?.email}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/30 hover:bg-accent/50 transition-colors text-[11px] font-bold text-accent"
          >
            {iniciales}
          </Link>
        </div>
      </div>
    </header>
  );
};
