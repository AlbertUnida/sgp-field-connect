import { Bell, Wifi } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
}

export const AppHeader = ({ title, subtitle }: AppHeaderProps) => {
  const { user } = useAuth();
  const { profile } = useProfile();

  const iniciales = [profile?.nombre, profile?.apellido]
    .filter(Boolean)
    .map((s) => s![0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <header className="sticky top-0 z-30 gradient-hero text-primary-foreground shadow-elevated">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 pt-3 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">SGP Campo</p>
          <h1 className="mt-0.5 text-xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-xs text-primary-foreground/70">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-success">
            <Wifi className="h-4 w-4" />
          </span>
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-primary" />
          </span>
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
