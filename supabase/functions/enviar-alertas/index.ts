// Edge Function: envía web push con las alertas vencidas de cada ejecutivo.
// Pensada para correr 1 vez al día vía cron (ver CLAUDE.md).
// Secrets requeridos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET
// (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY vienen inyectados por Supabase).
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (req) => {
  if (req.headers.get("authorization") !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("No autorizado", { status: 401 });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  webpush.setVapidDetails(
    "mailto:albertpapi@gmail.com",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!
  );

  const { data: subs } = await db.from("push_suscripciones").select("*");
  if (!subs || subs.length === 0) return Response.json({ enviadas: 0, motivo: "sin suscripciones" });

  const ejecutivos = [...new Set(subs.map((s) => s.ejecutivo_id))];
  const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [{ data: clientes }, { data: visitas }] = await Promise.all([
    db.from("clientes")
      .select("id, ejecutivo_id, rubro_rel:rubro_id(dias_visita)")
      .eq("activo", true)
      .neq("instancia", "CENSO")
      .in("ejecutivo_id", ejecutivos),
    db.from("gestiones")
      .select("cliente_id, created_at")
      .eq("tipo", "visita")
      .gte("created_at", hace30),
  ]);

  // Última visita por cliente
  const ultima = new Map<number, number>();
  for (const v of visitas ?? []) {
    const t = new Date(v.created_at).getTime();
    if (t > (ultima.get(v.cliente_id) ?? 0)) ultima.set(v.cliente_id, t);
  }

  // Visitas vencidas por ejecutivo (versión simplificada de Alertas:
  // no incluye "contactos vencidos 24h hábiles")
  const ahora = Date.now();
  const vencidasPor = new Map<string, number>();
  for (const c of clientes ?? []) {
    const limite = (c.rubro_rel as { dias_visita: number | null } | null)?.dias_visita ?? 7;
    const t = ultima.get(c.id);
    const dias = t ? (ahora - t) / 86_400_000 : 30;
    if (dias > limite) {
      vencidasPor.set(c.ejecutivo_id, (vencidasPor.get(c.ejecutivo_id) ?? 0) + 1);
    }
  }

  let enviadas = 0;
  for (const s of subs) {
    const n = vencidasPor.get(s.ejecutivo_id) ?? 0;
    if (n === 0) continue;
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({
          title: "SGP Campo — Alertas",
          body: `Tenés ${n} cliente${n > 1 ? "s" : ""} con visita vencida`,
          url: "/app/alertas",
        })
      );
      enviadas++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // Suscripción muerta (navegador la revocó): limpiar
      if (code === 404 || code === 410) {
        await db.from("push_suscripciones").delete().eq("endpoint", s.endpoint);
      }
    }
  }

  return Response.json({ enviadas, suscripciones: subs.length });
});
