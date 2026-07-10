import { supabase } from "./supabaseClient";

/**
 * Suscripción a notificaciones web push (alertas vencidas).
 * Requiere VITE_VAPID_PUBLIC_KEY en el entorno (Vercel + .env.local).
 * La suscripción se guarda en `push_suscripciones`; la Edge Function
 * `enviar-alertas` (cron diario) envía los avisos.
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type EstadoPush = "activas" | "inactivas" | "denegadas" | "no-soportado";

export const pushSoportado = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!pushSoportado() || !VAPID_PUBLIC_KEY) return "no-soportado";
  if (Notification.permission === "denied") return "denegadas";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? "activas" : "inactivas";
}

export async function activarPush(ejecutivoId: string): Promise<boolean> {
  if (!pushSoportado() || !VAPID_PUBLIC_KEY) return false;
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return false;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  const json = sub.toJSON();
  const { error } = await supabase.from("push_suscripciones").upsert(
    {
      ejecutivo_id: ejecutivoId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
    { onConflict: "endpoint" }
  );
  return !error;
}

export async function desactivarPush(): Promise<void> {
  if (!pushSoportado()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from("push_suscripciones").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
