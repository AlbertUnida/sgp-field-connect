import { useEffect, useState } from "react";
import { toast } from "sonner";
import { alCambiarCola, contarPendientes, sincronizarPendientes } from "@/lib/offline-queue";

/**
 * Estado de conexión + cantidad de gestiones pendientes de envío.
 * Para indicadores de UI (AppHeader).
 */
export function useOfflineEstado() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    const actualizar = () => contarPendientes().then(setPendientes).catch(() => {});
    actualizar();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const unsub = alCambiarCola(actualizar);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      unsub();
    };
  }, []);

  return { online, pendientes };
}

/**
 * Motor de sincronización: corre una sola vez (AppLayout).
 * Sincroniza al abrir la app, al volver la conexión y cada 60s (red inestable).
 */
export function useOfflineSync() {
  useEffect(() => {
    let corriendo = false;

    const sincronizar = async () => {
      if (corriendo || !navigator.onLine) return;
      corriendo = true;
      try {
        const n = await contarPendientes();
        if (n > 0) {
          const { enviadas, pendientes } = await sincronizarPendientes();
          if (enviadas > 0) toast.success(`📡 ${enviadas} gestión(es) offline sincronizada(s)`);
          if (pendientes > 0) toast.warning(`${pendientes} gestión(es) siguen pendientes de envío`);
        }
      } catch {
        // silencioso: se reintenta en el próximo ciclo
      } finally {
        corriendo = false;
      }
    };

    sincronizar();
    window.addEventListener("online", sincronizar);
    const timer = setInterval(sincronizar, 60_000);
    return () => {
      window.removeEventListener("online", sincronizar);
      clearInterval(timer);
    };
  }, []);
}
