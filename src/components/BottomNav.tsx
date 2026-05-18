import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Home, Users, Plus, BarChart3, Settings, UserPlus, ClipboardList, X, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";

const baseTabs = [
  { to: "/app", label: "Inicio", icon: Home, end: true },
  { to: "/app/clientes", label: "Clientes", icon: Users },
  { to: "/app/reportes", label: "Reportes", icon: BarChart3 },
];

export const BottomNav = () => {
  const { canManage } = useProfile();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Admin y supervisor ven el acceso al panel (admin ve todo; supervisor solo CENSO)
  const tabs = canManage
    ? [...baseTabs, { to: "/app/admin", label: "Admin", icon: Settings }]
    : baseTabs;

  return (
    <>
      {/* Menú flotante al presionar + */}
      {menuAbierto && (
        <>
          {/* Fondo oscuro */}
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
            onClick={() => setMenuAbierto(false)}
          />
          {/* Opciones */}
          <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 flex flex-col gap-3 items-center">
            <MenuOption
              icon={<UserPlus className="h-5 w-5" />}
              label="Nuevo cliente"
              color="bg-primary"
              onClick={() => { setMenuAbierto(false); navigate("/app/nuevo-cliente"); }}
            />
            <MenuOption
              icon={<ClipboardList className="h-5 w-5" />}
              label="Registrar gestión"
              color="bg-accent"
              onClick={() => { setMenuAbierto(false); navigate("/app/registrar"); }}
            />
            {canManage && (
              <MenuOption
                icon={<Receipt className="h-5 w-5" />}
                label="Ver cobros"
                color="bg-emerald-600"
                onClick={() => { setMenuAbierto(false); navigate("/app/cobros"); }}
              />
            )}
          </div>
        </>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg pb-safe">
        <ul className="mx-auto flex max-w-md items-stretch justify-around px-1 pt-1.5">

          {/* Tabs de la izquierda */}
          {tabs.slice(0, Math.ceil(tabs.length / 2)).map(({ to, label, icon: Icon, end }: any) => (
            <TabItem key={to} to={to} label={label} icon={Icon} end={end} />
          ))}

          {/* Botón central + */}
          <li className="flex-1 flex items-center justify-center">
            <button
              onClick={() => setMenuAbierto((v) => !v)}
              className={cn(
                "-mt-6 flex h-14 w-14 items-center justify-center rounded-full shadow-accent transition-smooth",
                menuAbierto ? "bg-destructive rotate-45" : "gradient-accent"
              )}
            >
              {menuAbierto
                ? <X className="h-6 w-6 text-white" strokeWidth={2.5} />
                : <Plus className="h-7 w-7 text-accent-foreground" strokeWidth={2.5} />
              }
            </button>
          </li>

          {/* Tabs de la derecha */}
          {tabs.slice(Math.ceil(tabs.length / 2)).map(({ to, label, icon: Icon, end }: any) => (
            <TabItem key={to} to={to} label={label} icon={Icon} end={end} />
          ))}
        </ul>
      </nav>
    </>
  );
};

const TabItem = ({ to, label, icon: Icon, end }: any) => (
  <li className="flex-1">
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 transition-smooth",
          "text-muted-foreground hover:text-foreground",
          isActive && "text-primary",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("h-5 w-5", isActive && "stroke-[2.4]")} />
          <span className={cn("text-[10px] font-medium", isActive && "font-semibold")}>{label}</span>
        </>
      )}
    </NavLink>
  </li>
);

const MenuOption = ({ icon, label, color, onClick }: {
  icon: React.ReactNode; label: string; color: string; onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 rounded-2xl bg-card border border-border px-5 py-3 shadow-elevated w-56 hover:border-primary/40 transition-smooth"
  >
    <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-white shrink-0", color)}>
      {icon}
    </span>
    <span className="text-sm font-semibold">{label}</span>
  </button>
);
