import { NavLink } from "react-router-dom";
import { Home, Users, PlusCircle, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/app", label: "Inicio", icon: Home, end: true },
  { to: "/app/clientes", label: "Clientes", icon: Users },
  { to: "/app/registrar", label: "Registrar", icon: PlusCircle, primary: true },
  { to: "/app/reportes", label: "Reportes", icon: BarChart3 },
];

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg pb-safe">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-1 pt-1.5">
        {tabs.map(({ to, label, icon: Icon, end, primary }) => (
          <li key={to} className="flex-1">
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
              {({ isActive }) =>
                primary ? (
                  <>
                    <span
                      className={cn(
                        "-mt-6 flex h-12 w-12 items-center justify-center rounded-full gradient-accent text-accent-foreground shadow-accent transition-smooth",
                        isActive && "scale-105",
                      )}
                    >
                      <Icon className="h-6 w-6" strokeWidth={2.5} />
                    </span>
                    <span className="mt-0.5 text-[10px] font-semibold">{label}</span>
                  </>
                ) : (
                  <>
                    <Icon className={cn("h-5 w-5", isActive && "stroke-[2.4]")} />
                    <span className={cn("text-[10px] font-medium", isActive && "font-semibold")}>{label}</span>
                  </>
                )
              }
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
