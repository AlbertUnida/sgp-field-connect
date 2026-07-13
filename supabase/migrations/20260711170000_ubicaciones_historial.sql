-- Historial de recorrido de los ejecutivos (para dibujar la polilínea del día
-- en Monitoreo). A diferencia de `ubicaciones_ejecutivos` (1 fila por usuario,
-- upsert de la posición actual), esta tabla ACUMULA puntos (insert por cada
-- reporte del hook useTracking, ya throttleado a 90s/150m). Retención 7 días.

CREATE TABLE IF NOT EXISTS public.ubicaciones_historial (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ejecutivo_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat          numeric(10,8) NOT NULL,
  lng          numeric(11,8) NOT NULL,
  accuracy     numeric,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ubic_hist_eje_fecha_idx
  ON public.ubicaciones_historial (ejecutivo_id, created_at);

ALTER TABLE public.ubicaciones_historial ENABLE ROW LEVEL SECURITY;

-- Cada ejecutivo inserta su propia posición
CREATE POLICY "insertar propia posicion historica"
  ON public.ubicaciones_historial FOR INSERT TO authenticated
  WITH CHECK (ejecutivo_id = auth.uid());

-- Cada uno ve la suya; admin/supervisor ven todas (para el mapa)
CREATE POLICY "leer historial recorrido"
  ON public.ubicaciones_historial FOR SELECT TO authenticated
  USING (
    ejecutivo_id = auth.uid()
    OR public.get_user_role() = ANY (ARRAY['admin', 'supervisor'])
  );

-- Retención 7 días: limpieza diaria (requiere pg_cron, ya habilitado)
select cron.schedule('limpiar-ubicaciones-historial', '0 4 * * *',
  $$ delete from public.ubicaciones_historial where created_at < now() - interval '7 days' $$);
