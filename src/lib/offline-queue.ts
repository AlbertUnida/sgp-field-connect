import { supabase } from "./supabaseClient";

/**
 * Cola offline de gestiones (IndexedDB).
 * Cuando no hay señal, las gestiones (incluida la foto) se guardan acá
 * y useOfflineSync las envía automáticamente al recuperar conexión.
 */

export interface GestionOffline {
  id?: number;
  creada_en: string;
  ejecutivo_id: string;
  /** Payload para insert en `gestiones` (sin foto_url, se resuelve al subir) */
  gestion: Record<string, unknown>;
  /** Update de clientes (ultima_gestion, proxima_accion) a aplicar tras el insert */
  cliente_update: { cliente_id: number | string; data: Record<string, unknown> } | null;
  foto: Blob | null;
  foto_tipo: string | null;
}

const DB_NOMBRE = "sgp-offline";
const STORE = "gestiones";
const EVENTO = "sgp-offline-cambio";

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOMBRE, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(modo: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return abrirDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, modo).objectStore(STORE));
        req.onsuccess = () => { resolve(req.result); db.close(); };
        req.onerror = () => { reject(req.error); db.close(); };
      })
  );
}

function notificar() {
  window.dispatchEvent(new CustomEvent(EVENTO));
}

/** Suscripción a cambios de la cola (para actualizar contadores en UI) */
export function alCambiarCola(cb: () => void): () => void {
  window.addEventListener(EVENTO, cb);
  return () => window.removeEventListener(EVENTO, cb);
}

export async function encolarGestion(g: Omit<GestionOffline, "id">): Promise<void> {
  await tx("readwrite", (s) => s.add(g));
  notificar();
}

export function contarPendientes(): Promise<number> {
  return tx("readonly", (s) => s.count());
}

function listarPendientes(): Promise<GestionOffline[]> {
  return tx("readonly", (s) => s.getAll() as IDBRequest<GestionOffline[]>);
}

function borrarPendiente(id: number): Promise<unknown> {
  return tx("readwrite", (s) => s.delete(id));
}

/** true si el error parece de red (sin señal), no de datos */
export function esErrorDeRed(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg =
    e instanceof Error
      ? e.message
      : e && typeof e === "object" && "message" in e
        ? String((e as { message: unknown }).message)
        : String(e ?? "");
  return /failed to fetch|network ?error|fetch failed|load failed|networkrequest/i.test(msg);
}

/**
 * Envía las gestiones encoladas, en orden.
 * - Error de red → corta y reintenta en el próximo ciclo.
 * - Error de datos → conserva el ítem, loguea y sigue con el siguiente.
 */
export async function sincronizarPendientes(): Promise<{ enviadas: number; pendientes: number }> {
  const items = await listarPendientes();
  let enviadas = 0;

  for (const item of items) {
    try {
      let fotoUrl: string | null = null;
      if (item.foto) {
        const path = `${item.ejecutivo_id}/${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from("gestiones-fotos")
          .upload(path, item.foto, { contentType: item.foto_tipo ?? "image/jpeg", upsert: false });
        if (error) throw error;
        fotoUrl = path;
      }

      const { error: errInsert } = await supabase
        .from("gestiones")
        .insert({ ...item.gestion, foto_url: fotoUrl });
      if (errInsert) throw errInsert;

      if (item.cliente_update) {
        await supabase
          .from("clientes")
          .update(item.cliente_update.data)
          .eq("id", item.cliente_update.cliente_id);
      }

      await borrarPendiente(item.id!);
      enviadas++;
    } catch (e) {
      if (esErrorDeRed(e)) break; // sin señal: reintentar más tarde
      console.warn("Sync offline: gestión no sincronizada:", e);
    }
  }

  notificar();
  return { enviadas, pendientes: await contarPendientes() };
}
