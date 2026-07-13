-- Fix RLS: al cobrar un local, registrar_cobro_local (SECURITY INVOKER) hace
--   UPDATE clientes SET instancia='COBRANZAS', ejecutivo_id = NULL ...
-- La política "Editar clientes" solo tenía USING (que Postgres aplica también
-- como WITH CHECK sobre la fila nueva). Con ejecutivo_id = NULL, un EJECUTIVO
-- común no pasaba el chequeo → "new row violates row-level security".
-- Se agrega un WITH CHECK explícito que además permite dejar la fila SIN
-- ejecutivo (ejecutivo_id IS NULL), que es la transición legítima del cobro.
-- El USING sigue restringiendo QUÉ filas puede tocar cada uno (las suyas o
-- admin/supervisor/cobranzas), así que no se abre acceso de más.

DROP POLICY IF EXISTS "Editar clientes" ON public.clientes;

CREATE POLICY "Editar clientes" ON public.clientes
  FOR UPDATE
  USING (
    (ejecutivo_id = auth.uid())
    OR (public.get_user_role() = ANY (ARRAY['admin', 'supervisor', 'cobranzas']))
  )
  WITH CHECK (
    (ejecutivo_id = auth.uid())
    OR (ejecutivo_id IS NULL)
    OR (public.get_user_role() = ANY (ARRAY['admin', 'supervisor', 'cobranzas']))
  );
