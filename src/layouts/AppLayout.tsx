import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { useTracking } from "@/hooks/useTracking";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { cn } from "@/lib/utils";

/**
 * Rutas que aprovechan todo el ancho en tablet/PC (dashboards, mapas).
 * El resto de la app se ensancha moderadamente en md+ para no estirar
 * tarjetas diseñadas para móvil.
 */
const RUTAS_ANCHAS = ["/app/monitoreo"];

const AppLayout = () => {
  const { pathname } = useLocation();
  const esAncha = RUTAS_ANCHAS.some((r) => pathname.startsWith(r));

  // Reporta la ubicación del usuario logueado para Monitoreo en vivo
  useTracking();

  // Sincroniza gestiones guardadas offline al recuperar conexión
  useOfflineSync();

  return (
    <div className="min-h-screen bg-background">
      <div
        className={cn(
          "mx-auto min-h-screen pb-24",
          esAncha ? "max-w-7xl" : "max-w-md md:max-w-2xl xl:max-w-3xl"
        )}
      >
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
