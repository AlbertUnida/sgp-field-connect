-- Al cobrar un local, el cliente pasa a COBRANZAS y queda SIN ejecutivo asignado
-- (ejecutivo_id = NULL). Un supervisor/admin del equipo de cobranzas lo asigna
-- después a un ejecutivo con rol 'cobranzas' (flujo análogo a CENSO→COMERCIAL).
-- El cobro en sí conserva su ejecutivo_id (quién lo registró); solo se limpia
-- el ejecutivo del CLIENTE.
-- Requiere que ya esté aplicada la migración 20260711130000 (RETURNS BIGINT).

CREATE OR REPLACE FUNCTION public.registrar_cobro_local(
  p_cliente_id          BIGINT,
  p_ejecutivo_id        UUID,
  p_registrado_por      UUID,
  p_monto               BIGINT,
  p_metodo_pago         TEXT,
  p_modalidad           TEXT,
  p_fecha_cobro         DATE,
  p_periodo_desde       DATE    DEFAULT NULL,
  p_periodo_hasta       DATE    DEFAULT NULL,
  p_referencia          TEXT    DEFAULT NULL,
  p_notas               TEXT    DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_cobro_id           BIGINT;
  v_instancia_anterior TEXT;
  v_dias_vigencia      INT := 30;
  v_fecha_vencimiento  DATE;
BEGIN
  SELECT c.instancia, COALESCE(r.dias_vigencia, 30)
  INTO   v_instancia_anterior, v_dias_vigencia
  FROM   clientes c
  LEFT JOIN rubros r ON r.id = c.rubro_id
  WHERE  c.id = p_cliente_id;

  v_fecha_vencimiento := p_fecha_cobro + v_dias_vigencia;

  INSERT INTO cobros (
    cliente_id, ejecutivo_id, registrado_por, monto,
    metodo_pago, modalidad, fecha_cobro,
    periodo_desde, periodo_hasta, referencia, notas
  ) VALUES (
    p_cliente_id, p_ejecutivo_id, p_registrado_por, p_monto,
    p_metodo_pago, p_modalidad, p_fecha_cobro,
    p_periodo_desde, p_periodo_hasta, p_referencia, p_notas
  )
  RETURNING id INTO v_cobro_id;

  -- Pasa a COBRANZAS y queda SIN ejecutivo (lo reasigna cobranzas)
  UPDATE clientes
  SET    instancia = 'COBRANZAS',
         fecha_vencimiento = v_fecha_vencimiento,
         ejecutivo_id = NULL
  WHERE  id = p_cliente_id;

  INSERT INTO historial_instancias (
    cliente_id, instancia_anterior, instancia_nueva, ejecutivo_id, notas
  ) VALUES (
    p_cliente_id,
    COALESCE(v_instancia_anterior, 'COMERCIAL'),
    'COBRANZAS',
    p_registrado_por,
    'Cobro registrado: ' || p_modalidad || ' — ' || p_metodo_pago
  );

  RETURN v_cobro_id;
END;
$$;
