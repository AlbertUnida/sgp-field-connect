-- Fix cobros: cobros.id es BIGINT (IDENTITY), pero registrar_cobro_local y
-- registrar_cobro_eventos declaraban `v_cobro_id UUID` y `RETURNS UUID`.
-- El `RETURNING id INTO v_cobro_id` intentaba meter el id numérico del cobro
-- en una variable UUID → "invalid input syntax for type uuid: <n>".
-- Se corrige el tipo a BIGINT en ambas. Cambia el tipo de retorno, así que
-- hay que DROP + CREATE (CREATE OR REPLACE no permite cambiar RETURNS).
-- La app ignora el valor devuelto, así que no requiere cambios en el frontend.

DROP FUNCTION IF EXISTS public.registrar_cobro_local(
  bigint, uuid, uuid, bigint, text, text, date, date, date, text, text);

DROP FUNCTION IF EXISTS public.registrar_cobro_eventos(
  bigint, uuid, uuid, bigint, text, text, date, uuid[], text, text, text, text, text, text, text, text);

-- ── RPC 1: Cobro de local ────────────────────────────────────────────────────
CREATE FUNCTION public.registrar_cobro_local(
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

  UPDATE clientes
  SET    instancia = 'COBRANZAS',
         fecha_vencimiento = v_fecha_vencimiento
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

-- ── RPC 2: Cobro de eventos ──────────────────────────────────────────────────
CREATE FUNCTION public.registrar_cobro_eventos(
  p_cliente_id           BIGINT,
  p_ejecutivo_id         UUID,
  p_registrado_por       UUID,
  p_monto                BIGINT,
  p_metodo_pago          TEXT,
  p_modalidad            TEXT,
  p_fecha_cobro          DATE,
  p_eventos_ids          UUID[],
  p_razon_social_factura TEXT    DEFAULT NULL,
  p_ruc_factura          TEXT    DEFAULT NULL,
  p_lugar_evento         TEXT    DEFAULT NULL,
  p_direccion_evento     TEXT    DEFAULT NULL,
  p_email_contacto       TEXT    DEFAULT NULL,
  p_telefono_contacto    TEXT    DEFAULT NULL,
  p_referencia           TEXT    DEFAULT NULL,
  p_notas                TEXT    DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_cobro_id BIGINT;
BEGIN
  INSERT INTO cobros (
    cliente_id, ejecutivo_id, registrado_por, monto,
    metodo_pago, modalidad, fecha_cobro, eventos_ids,
    razon_social_factura, ruc_factura,
    lugar_evento, direccion_evento,
    email_contacto, telefono_contacto,
    referencia, notas
  ) VALUES (
    p_cliente_id, p_ejecutivo_id, p_registrado_por, p_monto,
    p_metodo_pago, p_modalidad, p_fecha_cobro, p_eventos_ids,
    p_razon_social_factura, p_ruc_factura,
    p_lugar_evento, p_direccion_evento,
    p_email_contacto, p_telefono_contacto,
    p_referencia, p_notas
  )
  RETURNING id INTO v_cobro_id;

  UPDATE eventos_agenda
  SET    estado    = 'cerrado',
         instancia = 'COBRANZAS'
  WHERE  id = ANY(p_eventos_ids)
    AND  cliente_id = p_cliente_id;

  RETURN v_cobro_id;
END;
$$;

-- Permisos (DROP los elimina; se re-otorgan)
GRANT EXECUTE ON FUNCTION public.registrar_cobro_local(
  bigint, uuid, uuid, bigint, text, text, date, date, date, text, text)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.registrar_cobro_eventos(
  bigint, uuid, uuid, bigint, text, text, date, uuid[], text, text, text, text, text, text, text, text)
  TO anon, authenticated, service_role;
