-- Tabla de suscripciones web push (alertas vencidas).
-- La escribe el cliente (src/lib/push.ts) con el JWT del usuario autenticado:
--   activarPush()   -> upsert onConflict = endpoint
--   desactivarPush()-> delete by endpoint
-- La lee/limpia la Edge Function `enviar-alertas` con service_role (bypassa RLS).
-- Ejecutar en Supabase SQL Editor. Un usuario puede tener varias suscripciones
-- (una por dispositivo/navegador); la clave natural es el endpoint.

CREATE TABLE IF NOT EXISTS public.push_suscripciones (
  endpoint     text        PRIMARY KEY,
  ejecutivo_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  p256dh       text        NOT NULL,
  auth         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_suscripciones_ejecutivo_id_idx
  ON public.push_suscripciones (ejecutivo_id);

ALTER TABLE public.push_suscripciones ENABLE ROW LEVEL SECURITY;

-- El cliente hace upsert (INSERT + UPDATE) y delete de SUS propias filas.
CREATE POLICY "insertar propia suscripcion"
  ON public.push_suscripciones FOR INSERT TO authenticated
  WITH CHECK (ejecutivo_id = auth.uid());

CREATE POLICY "actualizar propia suscripcion"
  ON public.push_suscripciones FOR UPDATE TO authenticated
  USING (ejecutivo_id = auth.uid())
  WITH CHECK (ejecutivo_id = auth.uid());

CREATE POLICY "borrar propia suscripcion"
  ON public.push_suscripciones FOR DELETE TO authenticated
  USING (ejecutivo_id = auth.uid());

-- Cada uno ve la suya; admin/supervisor pueden auditar todas.
CREATE POLICY "leer suscripciones"
  ON public.push_suscripciones FOR SELECT TO authenticated
  USING (
    ejecutivo_id = auth.uid()
    OR public.get_user_role() = ANY (ARRAY['admin','supervisor'])
  );
