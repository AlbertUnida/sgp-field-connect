-- A1: Cobros atómicos — ambas funciones en una sola transacción PostgreSQL
-- Ejecutar en Supabase SQL Editor

-- ── RPC 1: Cobro de local (insert cobro + update cliente + historial) ──────
CREATE OR REPLACE FUNCTION registrar_cobro_local(
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
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_cobro_id           UUID;
  v_instancia_anterior TEXT;
  v_dias_vigencia      INT := 30;
  v_fecha_vencimiento  DATE;
BEGIN
  -- 1. Obtener instancia actual y días de vigencia del rubro
  SELECT c.instancia, COALESCE(r.dias_vigencia, 30)
  INTO   v_instancia_anterior, v_dias_vigencia
  FROM   clientes c
  LEFT JOIN rubros r ON r.id = c.rubro_id
  WHERE  c.id = p_cliente_id;

  v_fecha_vencimiento := p_fecha_cobro + v_dias_vigencia;

  -- 2. Insertar cobro
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

  -- 3. Mover cliente a COBRANZAS + calcular vencimiento
  UPDATE clientes
  SET    instancia = 'COBRANZAS',
         fecha_vencimiento = v_fecha_vencimiento
  WHERE  id = p_cliente_id;

  -- 4. Registrar en historial de instancias
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


-- ── RPC 2: Cobro de eventos (insert cobro + cerrar eventos) ─────────────────
CREATE OR REPLACE FUNCTION registrar_cobro_eventos(
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
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_cobro_id UUID;
BEGIN
  -- 1. Insertar cobro con lista de eventos
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

  -- 2. Marcar eventos como cerrado + COBRANZAS (mismo transaction)
  UPDATE eventos_agenda
  SET    estado    = 'cerrado',
         instancia = 'COBRANZAS'
  WHERE  id = ANY(p_eventos_ids)
    AND  cliente_id = p_cliente_id;  -- seguridad extra

  RETURN v_cobro_id;
END;
$$;
