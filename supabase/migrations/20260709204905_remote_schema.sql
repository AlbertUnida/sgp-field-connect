


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."actualizar_ejecucion_al_cobrar"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_mes integer;
  v_anio integer;
  v_meta decimal(15,2);
  v_mes_ant integer;
  v_anio_ant integer;
  v_deficit_ant decimal(15,2) := 0;
  v_ejecutado_nuevo decimal(15,2);
  v_deficit_nuevo decimal(15,2);
  v_superavit_nuevo decimal(15,2);
begin
  v_mes   := extract(month from new.fecha_cobro);
  v_anio  := extract(year  from new.fecha_cobro);

  select coalesce(monto_meta, 0) into v_meta
  from public.metas
  where ejecutivo_id = new.registrado_por 
    and mes = v_mes and anio = v_anio;

  if v_meta is null then v_meta := 0; end if;

  if v_mes = 1 then
    v_mes_ant := 12; v_anio_ant := v_anio - 1;
  else
    v_mes_ant := v_mes - 1; v_anio_ant := v_anio;
  end if;

  select coalesce(deficit_acumulado, 0) into v_deficit_ant
  from public.ejecucion_meta
  where ejecutivo_id = new.registrado_por 
    and mes = v_mes_ant and anio = v_anio_ant;

  insert into public.ejecucion_meta 
    (ejecutivo_id, mes, anio, monto_ejecutado, clientes_cobrados)
  values 
    (new.registrado_por, v_mes, v_anio, new.monto, 1)
  on conflict (ejecutivo_id, mes, anio)
  do update set
    monto_ejecutado  = ejecucion_meta.monto_ejecutado + new.monto,
    clientes_cobrados= ejecucion_meta.clientes_cobrados + 1,
    updated_at       = now();

  select monto_ejecutado into v_ejecutado_nuevo
  from public.ejecucion_meta
  where ejecutivo_id = new.registrado_por 
    and mes = v_mes and anio = v_anio;

  v_deficit_nuevo  := greatest(0, (v_meta + v_deficit_ant) - v_ejecutado_nuevo);
  v_superavit_nuevo:= greatest(0, v_ejecutado_nuevo - (v_meta + v_deficit_ant));

  update public.ejecucion_meta
  set deficit_acumulado   = v_deficit_nuevo,
      superavit_acumulado = v_superavit_nuevo,
      updated_at          = now()
  where ejecutivo_id = new.registrado_por 
    and mes = v_mes and anio = v_anio;

  return new;
end;
$$;


ALTER FUNCTION "public"."actualizar_ejecucion_al_cobrar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_user_profile"("target_user_id" "uuid", "p_nombre" "text", "p_apellido" "text", "p_rol" "text", "p_email" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  calling_role TEXT;
BEGIN
  -- Solo admins y supervisores pueden llamar esta función
  SELECT rol INTO calling_role FROM profiles WHERE id = auth.uid();
  IF calling_role NOT IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Solo admins pueden asignar el rol admin
  IF p_rol = 'admin' AND calling_role != 'admin' THEN
    RAISE EXCEPTION 'Solo un admin puede asignar el rol admin';
  END IF;

  INSERT INTO profiles (id, nombre, apellido, rol, email, activo)
  VALUES (target_user_id, p_nombre, p_apellido, p_rol, p_email, true)
  ON CONFLICT (id) DO UPDATE SET
    nombre   = EXCLUDED.nombre,
    apellido = EXCLUDED.apellido,
    rol      = EXCLUDED.rol,
    email    = COALESCE(EXCLUDED.email, profiles.email),
    activo   = true;
END;
$$;


ALTER FUNCTION "public"."admin_set_user_profile"("target_user_id" "uuid", "p_nombre" "text", "p_apellido" "text", "p_rol" "text", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_rol"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT rol FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_rol"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select rol from public.profiles where id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, nombre, email, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', 
             split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'rol', 'ejecutivo')
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_cobro_eventos"("p_cliente_id" bigint, "p_ejecutivo_id" "uuid", "p_registrado_por" "uuid", "p_monto" bigint, "p_metodo_pago" "text", "p_modalidad" "text", "p_fecha_cobro" "date", "p_eventos_ids" "uuid"[], "p_razon_social_factura" "text" DEFAULT NULL::"text", "p_ruc_factura" "text" DEFAULT NULL::"text", "p_lugar_evento" "text" DEFAULT NULL::"text", "p_direccion_evento" "text" DEFAULT NULL::"text", "p_email_contacto" "text" DEFAULT NULL::"text", "p_telefono_contacto" "text" DEFAULT NULL::"text", "p_referencia" "text" DEFAULT NULL::"text", "p_notas" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cobro_id UUID;
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


ALTER FUNCTION "public"."registrar_cobro_eventos"("p_cliente_id" bigint, "p_ejecutivo_id" "uuid", "p_registrado_por" "uuid", "p_monto" bigint, "p_metodo_pago" "text", "p_modalidad" "text", "p_fecha_cobro" "date", "p_eventos_ids" "uuid"[], "p_razon_social_factura" "text", "p_ruc_factura" "text", "p_lugar_evento" "text", "p_direccion_evento" "text", "p_email_contacto" "text", "p_telefono_contacto" "text", "p_referencia" "text", "p_notas" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_cobro_local"("p_cliente_id" bigint, "p_ejecutivo_id" "uuid", "p_registrado_por" "uuid", "p_monto" bigint, "p_metodo_pago" "text", "p_modalidad" "text", "p_fecha_cobro" "date", "p_periodo_desde" "date" DEFAULT NULL::"date", "p_periodo_hasta" "date" DEFAULT NULL::"date", "p_referencia" "text" DEFAULT NULL::"text", "p_notas" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cobro_id           UUID;
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


ALTER FUNCTION "public"."registrar_cobro_local"("p_cliente_id" bigint, "p_ejecutivo_id" "uuid", "p_registrado_por" "uuid", "p_monto" bigint, "p_metodo_pago" "text", "p_modalidad" "text", "p_fecha_cobro" "date", "p_periodo_desde" "date", "p_periodo_hasta" "date", "p_referencia" "text", "p_notas" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."categorias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."categorias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gestiones" (
    "id" bigint NOT NULL,
    "cliente_id" bigint NOT NULL,
    "ejecutivo_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "fecha_inicio" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fecha_fin" timestamp with time zone,
    "duracion_minutos" integer,
    "resultado" "text",
    "nota" "text",
    "foto_url" "text",
    "lat_inicio" numeric(10,8),
    "lng_inicio" numeric(11,8),
    "lat_fin" numeric(10,8),
    "lng_fin" numeric(11,8),
    "etapa_id" bigint,
    "tarea_id" bigint,
    "monto_cobrado" numeric(15,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resultado_id" "uuid",
    "datos_extra" "jsonb",
    "evento_id" "uuid",
    "proxima_accion" "text",
    CONSTRAINT "gestiones_tipo_check" CHECK (("tipo" = ANY (ARRAY['visita'::"text", 'llamada'::"text", 'email'::"text", 'whatsapp'::"text", 'cobro_campo'::"text", 'otro'::"text"])))
);


ALTER TABLE "public"."gestiones" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."cliente_lead_scores" AS
 SELECT "cliente_id",
    ("sum"((("datos_extra" ->> 'score'::"text"))::integer))::integer AS "lead_score"
   FROM "public"."gestiones"
  WHERE (("datos_extra" IS NOT NULL) AND (("datos_extra" ->> 'score'::"text") IS NOT NULL))
  GROUP BY "cliente_id";


ALTER VIEW "public"."cliente_lead_scores" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."clientes_numero_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."clientes_numero_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" bigint NOT NULL,
    "nombre_comercial" "text" NOT NULL,
    "nombre_contacto" "text",
    "ruc" "text",
    "direccion" "text" NOT NULL,
    "lat" numeric(10,8),
    "lng" numeric(11,8),
    "rubro" "text",
    "ciudad" "text",
    "zona" "text",
    "departamento" "text",
    "telefono" "text",
    "email_cliente" "text",
    "instancia" "text" DEFAULT 'CENSO'::"text" NOT NULL,
    "etapa_actual_id" bigint,
    "ejecutivo_id" "uuid",
    "supervisor_id" "uuid",
    "tarifa_mensual" numeric(15,2),
    "modalidad_pago" "text",
    "fecha_ultimo_pago" "date",
    "fecha_proximo_pago" "date",
    "activo" boolean DEFAULT true,
    "notas" "text",
    "foto_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "categoria_id" "uuid",
    "rubro_id" "uuid",
    "tipo_cliente" "text" DEFAULT 'local'::"text",
    "estado" "text" DEFAULT 'activo'::"text",
    "motivo_estado" "text",
    "razon_social" "text",
    "barrio" "text",
    "localidad" "text",
    "calle_secundaria" "text",
    "creado_por" "uuid",
    "proxima_accion" "date",
    "ultima_gestion" timestamp with time zone,
    "fecha_vencimiento" "date",
    "sub_rubro_id" "uuid",
    "numero_cliente" bigint DEFAULT "nextval"('"public"."clientes_numero_seq"'::"regclass"),
    "nombre_salon" "text",
    "capacidad" integer,
    CONSTRAINT "clientes_estado_check" CHECK (("estado" = ANY (ARRAY['activo'::"text", 'inactivo'::"text", 'baja'::"text"]))),
    CONSTRAINT "clientes_instancia_check" CHECK (("instancia" = ANY (ARRAY['CENSO'::"text", 'COMERCIAL'::"text", 'COBRANZAS'::"text", 'JURIDICO'::"text"]))),
    CONSTRAINT "clientes_modalidad_pago_check" CHECK (("modalidad_pago" = ANY (ARRAY['mensual'::"text", 'semestral'::"text", 'anual'::"text"]))),
    CONSTRAINT "clientes_tipo_cliente_check" CHECK (("tipo_cliente" = ANY (ARRAY['local'::"text", 'evento'::"text"])))
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


ALTER TABLE "public"."clientes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."clientes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."cobros" (
    "id" bigint NOT NULL,
    "cliente_id" bigint NOT NULL,
    "ejecutivo_id" "uuid",
    "registrado_por" "uuid" NOT NULL,
    "monto" numeric(15,2) NOT NULL,
    "modalidad" "text" NOT NULL,
    "fecha_cobro" "date" DEFAULT CURRENT_DATE NOT NULL,
    "fecha_vencimiento" "date",
    "periodo_desde" "date",
    "periodo_hasta" "date",
    "comprobante_url" "text",
    "metodo_pago" "text",
    "referencia" "text",
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "eventos_ids" "uuid"[],
    "razon_social_factura" "text",
    "ruc_factura" "text",
    "lugar_evento" "text",
    "email_contacto" "text",
    "telefono_contacto" "text",
    "direccion_evento" "text",
    CONSTRAINT "cobros_metodo_pago_check" CHECK (("metodo_pago" = ANY (ARRAY['efectivo'::"text", 'transferencia'::"text", 'cheque'::"text", 'tarjeta'::"text", 'otro'::"text"]))),
    CONSTRAINT "cobros_modalidad_check" CHECK (("modalidad" = ANY (ARRAY['mensual'::"text", 'trimestral'::"text", 'semestral'::"text", 'anual'::"text", 'pago_unico'::"text", 'evento'::"text"])))
);


ALTER TABLE "public"."cobros" OWNER TO "postgres";


ALTER TABLE "public"."cobros" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."cobros_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."ejecucion_meta" (
    "id" bigint NOT NULL,
    "ejecutivo_id" "uuid" NOT NULL,
    "mes" integer NOT NULL,
    "anio" integer NOT NULL,
    "monto_ejecutado" numeric(15,2) DEFAULT 0,
    "clientes_cobrados" integer DEFAULT 0,
    "deficit_acumulado" numeric(15,2) DEFAULT 0,
    "superavit_acumulado" numeric(15,2) DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ejecucion_meta_mes_check" CHECK ((("mes" >= 1) AND ("mes" <= 12)))
);


ALTER TABLE "public"."ejecucion_meta" OWNER TO "postgres";


ALTER TABLE "public"."ejecucion_meta" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."ejecucion_meta_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."etapas" (
    "id" bigint NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "orden" integer NOT NULL,
    "color" "text" DEFAULT '#2E75B6'::"text",
    "activa" boolean DEFAULT true,
    "requiere_aprobacion_supervisor" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."etapas" OWNER TO "postgres";


ALTER TABLE "public"."etapas" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."etapas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."eventos_agenda" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_evento" bigint NOT NULL,
    "cliente_id" bigint NOT NULL,
    "nombre_evento" "text",
    "fecha_evento" "date",
    "tipo_evento" "text",
    "tarifa_evento" integer,
    "estado" "text" DEFAULT 'prospecto'::"text" NOT NULL,
    "ejecutivo_id" "uuid",
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "nombre_salon" "text",
    "capacidad" integer,
    "rubro_evento_id" "uuid",
    "instancia" "text" DEFAULT 'COMERCIAL'::"text"
);


ALTER TABLE "public"."eventos_agenda" OWNER TO "postgres";


ALTER TABLE "public"."eventos_agenda" ALTER COLUMN "numero_evento" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."eventos_agenda_numero_evento_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."gestiones" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."gestiones_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."historial_instancias" (
    "id" bigint NOT NULL,
    "cliente_id" bigint NOT NULL,
    "instancia_anterior" "text",
    "instancia_nueva" "text" NOT NULL,
    "ejecutivo_id" "uuid",
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."historial_instancias" OWNER TO "postgres";


ALTER TABLE "public"."historial_instancias" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."historial_instancias_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."instancias_log" (
    "id" bigint NOT NULL,
    "cliente_id" bigint NOT NULL,
    "instancia_anterior" "text",
    "instancia_nueva" "text" NOT NULL,
    "ejecutivo_id" "uuid",
    "supervisor_id" "uuid",
    "motivo" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."instancias_log" OWNER TO "postgres";


ALTER TABLE "public"."instancias_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."instancias_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."metas" (
    "id" bigint NOT NULL,
    "ejecutivo_id" "uuid" NOT NULL,
    "mes" integer NOT NULL,
    "anio" integer NOT NULL,
    "monto_meta" numeric(15,2) DEFAULT 0 NOT NULL,
    "clientes_meta" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "metas_mes_check" CHECK ((("mes" >= 1) AND ("mes" <= 12)))
);


ALTER TABLE "public"."metas" OWNER TO "postgres";


ALTER TABLE "public"."metas" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."metas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."notificaciones" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "mensaje" "text",
    "leida" boolean DEFAULT false,
    "link" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notificaciones" OWNER TO "postgres";


ALTER TABLE "public"."notificaciones" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."notificaciones_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "apellido" "text",
    "email" "text" NOT NULL,
    "telefono" "text",
    "rol" "text" DEFAULT 'ejecutivo'::"text" NOT NULL,
    "supervisor_id" "uuid",
    "activo" boolean DEFAULT true,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profiles_rol_check" CHECK (("rol" = ANY (ARRAY['admin'::"text", 'supervisor'::"text", 'ejecutivo'::"text", 'cobranzas'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rubros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "categoria_id" "uuid",
    "nombre" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "dias_visita" integer DEFAULT 7,
    "dias_vigencia" integer DEFAULT 30
);


ALTER TABLE "public"."rubros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rubros_evento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rubros_evento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rutas" (
    "id" bigint NOT NULL,
    "ejecutivo_id" "uuid" NOT NULL,
    "fecha" "date" DEFAULT CURRENT_DATE NOT NULL,
    "cliente_ids" bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    "orden_optimizado" bigint[] DEFAULT '{}'::bigint[],
    "completada" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rutas" OWNER TO "postgres";


ALTER TABLE "public"."rutas" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."rutas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."sub_rubros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rubro_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sub_rubros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tarea_completada" (
    "id" bigint NOT NULL,
    "cliente_id" bigint NOT NULL,
    "tarea_id" bigint NOT NULL,
    "etapa_id" bigint NOT NULL,
    "ejecutivo_id" "uuid" NOT NULL,
    "nota" "text",
    "foto_url" "text",
    "lat" numeric(10,8),
    "lng" numeric(11,8),
    "aprobada" boolean,
    "aprobada_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tarea_completada" OWNER TO "postgres";


ALTER TABLE "public"."tarea_completada" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."tarea_completada_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tareas" (
    "id" bigint NOT NULL,
    "etapa_id" bigint NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "tipo" "text" DEFAULT 'visita'::"text" NOT NULL,
    "requerida" boolean DEFAULT true,
    "orden" integer NOT NULL,
    "activa" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tareas_tipo_check" CHECK (("tipo" = ANY (ARRAY['visita'::"text", 'llamada'::"text", 'email'::"text", 'whatsapp'::"text", 'documento'::"text", 'foto'::"text", 'otro'::"text"])))
);


ALTER TABLE "public"."tareas" OWNER TO "postgres";


ALTER TABLE "public"."tareas" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."tareas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tipos_evento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tipos_evento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tipos_resultado" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo_formulario" "text",
    "activo" boolean DEFAULT true,
    "orden" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tipo_cartera" "text" DEFAULT 'ambos'::"text" NOT NULL
);


ALTER TABLE "public"."tipos_resultado" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ubicaciones_ejecutivos" (
    "ejecutivo_id" "uuid" NOT NULL,
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "accuracy" double precision,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ubicaciones_ejecutivos" OWNER TO "postgres";


ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."categorias"
    ADD CONSTRAINT "categorias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cobros"
    ADD CONSTRAINT "cobros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ejecucion_meta"
    ADD CONSTRAINT "ejecucion_meta_ejecutivo_id_mes_anio_key" UNIQUE ("ejecutivo_id", "mes", "anio");



ALTER TABLE ONLY "public"."ejecucion_meta"
    ADD CONSTRAINT "ejecucion_meta_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."etapas"
    ADD CONSTRAINT "etapas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eventos_agenda"
    ADD CONSTRAINT "eventos_agenda_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gestiones"
    ADD CONSTRAINT "gestiones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historial_instancias"
    ADD CONSTRAINT "historial_instancias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."instancias_log"
    ADD CONSTRAINT "instancias_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_ejecutivo_id_mes_anio_key" UNIQUE ("ejecutivo_id", "mes", "anio");



ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rubros"
    ADD CONSTRAINT "rubros_categoria_id_nombre_key" UNIQUE ("categoria_id", "nombre");



ALTER TABLE ONLY "public"."rubros_evento"
    ADD CONSTRAINT "rubros_evento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rubros"
    ADD CONSTRAINT "rubros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rutas"
    ADD CONSTRAINT "rutas_ejecutivo_id_fecha_key" UNIQUE ("ejecutivo_id", "fecha");



ALTER TABLE ONLY "public"."rutas"
    ADD CONSTRAINT "rutas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sub_rubros"
    ADD CONSTRAINT "sub_rubros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tarea_completada"
    ADD CONSTRAINT "tarea_completada_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tareas"
    ADD CONSTRAINT "tareas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tipos_evento"
    ADD CONSTRAINT "tipos_evento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tipos_resultado"
    ADD CONSTRAINT "tipos_resultado_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ubicaciones_ejecutivos"
    ADD CONSTRAINT "ubicaciones_ejecutivos_pkey" PRIMARY KEY ("ejecutivo_id");



CREATE INDEX "idx_clientes_ejecutivo" ON "public"."clientes" USING "btree" ("ejecutivo_id");



CREATE INDEX "idx_clientes_instancia" ON "public"."clientes" USING "btree" ("instancia");



CREATE INDEX "idx_cobros_cliente" ON "public"."cobros" USING "btree" ("cliente_id");



CREATE INDEX "idx_cobros_fecha" ON "public"."cobros" USING "btree" ("fecha_cobro");



CREATE INDEX "idx_gestiones_cliente" ON "public"."gestiones" USING "btree" ("cliente_id");



CREATE INDEX "idx_gestiones_ejecutivo" ON "public"."gestiones" USING "btree" ("ejecutivo_id");



CREATE INDEX "idx_gestiones_fecha" ON "public"."gestiones" USING "btree" ("fecha_inicio");



CREATE INDEX "idx_notif_user" ON "public"."notificaciones" USING "btree" ("user_id", "leida");



CREATE OR REPLACE TRIGGER "on_cobro_registrado" AFTER INSERT ON "public"."cobros" FOR EACH ROW EXECUTE FUNCTION "public"."actualizar_ejecucion_al_cobrar"();



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_ejecutivo_id_fkey" FOREIGN KEY ("ejecutivo_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_etapa_fk" FOREIGN KEY ("etapa_actual_id") REFERENCES "public"."etapas"("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_rubro_id_fkey" FOREIGN KEY ("rubro_id") REFERENCES "public"."rubros"("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_sub_rubro_id_fkey" FOREIGN KEY ("sub_rubro_id") REFERENCES "public"."sub_rubros"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."cobros"
    ADD CONSTRAINT "cobros_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cobros"
    ADD CONSTRAINT "cobros_ejecutivo_id_fkey" FOREIGN KEY ("ejecutivo_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."cobros"
    ADD CONSTRAINT "cobros_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."ejecucion_meta"
    ADD CONSTRAINT "ejecucion_meta_ejecutivo_id_fkey" FOREIGN KEY ("ejecutivo_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."eventos_agenda"
    ADD CONSTRAINT "eventos_agenda_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."eventos_agenda"
    ADD CONSTRAINT "eventos_agenda_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."eventos_agenda"
    ADD CONSTRAINT "eventos_agenda_ejecutivo_id_fkey" FOREIGN KEY ("ejecutivo_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."eventos_agenda"
    ADD CONSTRAINT "eventos_agenda_rubro_evento_id_fkey" FOREIGN KEY ("rubro_evento_id") REFERENCES "public"."rubros_evento"("id");



ALTER TABLE ONLY "public"."gestiones"
    ADD CONSTRAINT "gestiones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gestiones"
    ADD CONSTRAINT "gestiones_ejecutivo_id_fkey" FOREIGN KEY ("ejecutivo_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."gestiones"
    ADD CONSTRAINT "gestiones_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "public"."etapas"("id");



ALTER TABLE ONLY "public"."gestiones"
    ADD CONSTRAINT "gestiones_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos_agenda"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gestiones"
    ADD CONSTRAINT "gestiones_resultado_id_fkey" FOREIGN KEY ("resultado_id") REFERENCES "public"."tipos_resultado"("id");



ALTER TABLE ONLY "public"."gestiones"
    ADD CONSTRAINT "gestiones_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "public"."tareas"("id");



ALTER TABLE ONLY "public"."historial_instancias"
    ADD CONSTRAINT "historial_instancias_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historial_instancias"
    ADD CONSTRAINT "historial_instancias_ejecutivo_id_fkey" FOREIGN KEY ("ejecutivo_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."instancias_log"
    ADD CONSTRAINT "instancias_log_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."instancias_log"
    ADD CONSTRAINT "instancias_log_ejecutivo_id_fkey" FOREIGN KEY ("ejecutivo_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."instancias_log"
    ADD CONSTRAINT "instancias_log_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_ejecutivo_id_fkey" FOREIGN KEY ("ejecutivo_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "notificaciones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."rubros"
    ADD CONSTRAINT "rubros_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rutas"
    ADD CONSTRAINT "rutas_ejecutivo_id_fkey" FOREIGN KEY ("ejecutivo_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."sub_rubros"
    ADD CONSTRAINT "sub_rubros_rubro_id_fkey" FOREIGN KEY ("rubro_id") REFERENCES "public"."rubros"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tarea_completada"
    ADD CONSTRAINT "tarea_completada_aprobada_por_fkey" FOREIGN KEY ("aprobada_por") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tarea_completada"
    ADD CONSTRAINT "tarea_completada_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tarea_completada"
    ADD CONSTRAINT "tarea_completada_ejecutivo_id_fkey" FOREIGN KEY ("ejecutivo_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tarea_completada"
    ADD CONSTRAINT "tarea_completada_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "public"."etapas"("id");



ALTER TABLE ONLY "public"."tarea_completada"
    ADD CONSTRAINT "tarea_completada_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "public"."tareas"("id");



ALTER TABLE ONLY "public"."tareas"
    ADD CONSTRAINT "tareas_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "public"."etapas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ubicaciones_ejecutivos"
    ADD CONSTRAINT "ubicaciones_ejecutivos_ejecutivo_id_fkey" FOREIGN KEY ("ejecutivo_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admin crea perfiles" ON "public"."profiles" FOR INSERT WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "Admin gestiona categorias" ON "public"."categorias" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = 'admin'::"text")))));



CREATE POLICY "Admin gestiona etapas" ON "public"."etapas" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "Admin gestiona rubros" ON "public"."rubros" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = 'admin'::"text")))));



CREATE POLICY "Admin gestiona tareas" ON "public"."tareas" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "Admin y supervisor gestionan metas" ON "public"."metas" USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])));



CREATE POLICY "Autenticados pueden insertar historial" ON "public"."historial_instancias" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Autenticados pueden leer historial" ON "public"."historial_instancias" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Crear clientes" ON "public"."clientes" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Editar clientes" ON "public"."clientes" FOR UPDATE USING ((("ejecutivo_id" = "auth"."uid"()) OR ("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'supervisor'::"text", 'cobranzas'::"text"]))));



CREATE POLICY "Editar propio perfil" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Gestionar rutas propias" ON "public"."rutas" USING ((("ejecutivo_id" = "auth"."uid"()) OR ("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))));



CREATE POLICY "Insertar notificaciones" ON "public"."notificaciones" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Lectura libre categorias" ON "public"."categorias" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lectura libre rubros" ON "public"."rubros" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Marcar como leída" ON "public"."notificaciones" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Registrar cobros" ON "public"."cobros" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Registrar gestiones" ON "public"."gestiones" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Registrar instancias log" ON "public"."instancias_log" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Registrar tareas completadas" ON "public"."tarea_completada" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Sistema actualiza ejecucion" ON "public"."ejecucion_meta" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Ver clientes" ON "public"."clientes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Ver cobros" ON "public"."cobros" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Ver ejecucion propia" ON "public"."ejecucion_meta" FOR SELECT USING ((("ejecutivo_id" = "auth"."uid"()) OR ("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))));



CREATE POLICY "Ver etapas" ON "public"."etapas" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Ver gestiones propias o supervisor" ON "public"."gestiones" FOR SELECT USING ((("ejecutivo_id" = "auth"."uid"()) OR ("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'supervisor'::"text", 'cobranzas'::"text"]))));



CREATE POLICY "Ver instancias log" ON "public"."instancias_log" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Ver metas propias" ON "public"."metas" FOR SELECT USING ((("ejecutivo_id" = "auth"."uid"()) OR ("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))));



CREATE POLICY "Ver perfiles" ON "public"."profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Ver propias notificaciones" ON "public"."notificaciones" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Ver rutas propias" ON "public"."rutas" FOR SELECT USING ((("ejecutivo_id" = "auth"."uid"()) OR ("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))));



CREATE POLICY "Ver tareas" ON "public"."tareas" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Ver tareas completadas" ON "public"."tarea_completada" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "actualizar propia ubicacion" ON "public"."ubicaciones_ejecutivos" FOR UPDATE TO "authenticated" USING (("ejecutivo_id" = "auth"."uid"()));



CREATE POLICY "admin modifica tipos_resultado" ON "public"."tipos_resultado" USING (("public"."get_my_rol"() = 'admin'::"text"));



CREATE POLICY "admins_pueden_actualizar_perfiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("public"."get_my_rol"() = 'admin'::"text")) WITH CHECK (("public"."get_my_rol"() = 'admin'::"text"));



ALTER TABLE "public"."categorias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cobros" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ejecucion_meta" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ejecutivo_actualiza_censo_propio" ON "public"."clientes" FOR UPDATE USING ((("creado_por" = "auth"."uid"()) AND ("instancia" = 'CENSO'::"text"))) WITH CHECK ((("creado_por" = "auth"."uid"()) AND ("instancia" = 'CENSO'::"text")));



ALTER TABLE "public"."etapas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."eventos_agenda" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "eventos_insert" ON "public"."eventos_agenda" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "eventos_select" ON "public"."eventos_agenda" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "eventos_update" ON "public"."eventos_agenda" FOR UPDATE TO "authenticated" USING ((("ejecutivo_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])))))));



CREATE POLICY "gestion_sub_rubros" ON "public"."sub_rubros" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"]))))));



ALTER TABLE "public"."gestiones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."historial_instancias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insertar propia ubicacion" ON "public"."ubicaciones_ejecutivos" FOR INSERT TO "authenticated" WITH CHECK (("ejecutivo_id" = "auth"."uid"()));



ALTER TABLE "public"."instancias_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lectura_sub_rubros" ON "public"."sub_rubros" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "leer ubicaciones" ON "public"."ubicaciones_ejecutivos" FOR SELECT TO "authenticated" USING ((("ejecutivo_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."rol" = ANY (ARRAY['admin'::"text", 'supervisor'::"text"])))))));



CREATE POLICY "manage_rubros_evento" ON "public"."rubros_evento" TO "authenticated" USING (true);



CREATE POLICY "manage_tipos_evento" ON "public"."tipos_evento" TO "authenticated" USING (true);



CREATE POLICY "managers_read_all_profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."metas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notificaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read_rubros_evento" ON "public"."rubros_evento" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read_tipos_evento" ON "public"."tipos_evento" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."rubros" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rubros_evento" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rutas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sub_rubros" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tarea_completada" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tareas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tipos_evento" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tipos_resultado" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "todos leen tipos_resultado" ON "public"."tipos_resultado" FOR SELECT USING (true);



ALTER TABLE "public"."ubicaciones_ejecutivos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update_eventos_agenda" ON "public"."eventos_agenda" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."gestiones";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."ubicaciones_ejecutivos";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."actualizar_ejecucion_al_cobrar"() TO "anon";
GRANT ALL ON FUNCTION "public"."actualizar_ejecucion_al_cobrar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."actualizar_ejecucion_al_cobrar"() TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_set_user_profile"("target_user_id" "uuid", "p_nombre" "text", "p_apellido" "text", "p_rol" "text", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_set_user_profile"("target_user_id" "uuid", "p_nombre" "text", "p_apellido" "text", "p_rol" "text", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_user_profile"("target_user_id" "uuid", "p_nombre" "text", "p_apellido" "text", "p_rol" "text", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_rol"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_rol"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_rol"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_cobro_eventos"("p_cliente_id" bigint, "p_ejecutivo_id" "uuid", "p_registrado_por" "uuid", "p_monto" bigint, "p_metodo_pago" "text", "p_modalidad" "text", "p_fecha_cobro" "date", "p_eventos_ids" "uuid"[], "p_razon_social_factura" "text", "p_ruc_factura" "text", "p_lugar_evento" "text", "p_direccion_evento" "text", "p_email_contacto" "text", "p_telefono_contacto" "text", "p_referencia" "text", "p_notas" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_cobro_eventos"("p_cliente_id" bigint, "p_ejecutivo_id" "uuid", "p_registrado_por" "uuid", "p_monto" bigint, "p_metodo_pago" "text", "p_modalidad" "text", "p_fecha_cobro" "date", "p_eventos_ids" "uuid"[], "p_razon_social_factura" "text", "p_ruc_factura" "text", "p_lugar_evento" "text", "p_direccion_evento" "text", "p_email_contacto" "text", "p_telefono_contacto" "text", "p_referencia" "text", "p_notas" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_cobro_eventos"("p_cliente_id" bigint, "p_ejecutivo_id" "uuid", "p_registrado_por" "uuid", "p_monto" bigint, "p_metodo_pago" "text", "p_modalidad" "text", "p_fecha_cobro" "date", "p_eventos_ids" "uuid"[], "p_razon_social_factura" "text", "p_ruc_factura" "text", "p_lugar_evento" "text", "p_direccion_evento" "text", "p_email_contacto" "text", "p_telefono_contacto" "text", "p_referencia" "text", "p_notas" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."registrar_cobro_local"("p_cliente_id" bigint, "p_ejecutivo_id" "uuid", "p_registrado_por" "uuid", "p_monto" bigint, "p_metodo_pago" "text", "p_modalidad" "text", "p_fecha_cobro" "date", "p_periodo_desde" "date", "p_periodo_hasta" "date", "p_referencia" "text", "p_notas" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."registrar_cobro_local"("p_cliente_id" bigint, "p_ejecutivo_id" "uuid", "p_registrado_por" "uuid", "p_monto" bigint, "p_metodo_pago" "text", "p_modalidad" "text", "p_fecha_cobro" "date", "p_periodo_desde" "date", "p_periodo_hasta" "date", "p_referencia" "text", "p_notas" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_cobro_local"("p_cliente_id" bigint, "p_ejecutivo_id" "uuid", "p_registrado_por" "uuid", "p_monto" bigint, "p_metodo_pago" "text", "p_modalidad" "text", "p_fecha_cobro" "date", "p_periodo_desde" "date", "p_periodo_hasta" "date", "p_referencia" "text", "p_notas" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."categorias" TO "anon";
GRANT ALL ON TABLE "public"."categorias" TO "authenticated";
GRANT ALL ON TABLE "public"."categorias" TO "service_role";



GRANT ALL ON TABLE "public"."gestiones" TO "anon";
GRANT ALL ON TABLE "public"."gestiones" TO "authenticated";
GRANT ALL ON TABLE "public"."gestiones" TO "service_role";



GRANT ALL ON TABLE "public"."cliente_lead_scores" TO "anon";
GRANT ALL ON TABLE "public"."cliente_lead_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."cliente_lead_scores" TO "service_role";



GRANT ALL ON SEQUENCE "public"."clientes_numero_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."clientes_numero_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."clientes_numero_seq" TO "service_role";



GRANT ALL ON TABLE "public"."clientes" TO "anon";
GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."clientes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."clientes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."clientes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cobros" TO "anon";
GRANT ALL ON TABLE "public"."cobros" TO "authenticated";
GRANT ALL ON TABLE "public"."cobros" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cobros_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cobros_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cobros_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ejecucion_meta" TO "anon";
GRANT ALL ON TABLE "public"."ejecucion_meta" TO "authenticated";
GRANT ALL ON TABLE "public"."ejecucion_meta" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ejecucion_meta_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ejecucion_meta_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ejecucion_meta_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."etapas" TO "anon";
GRANT ALL ON TABLE "public"."etapas" TO "authenticated";
GRANT ALL ON TABLE "public"."etapas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."etapas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."etapas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."etapas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."eventos_agenda" TO "anon";
GRANT ALL ON TABLE "public"."eventos_agenda" TO "authenticated";
GRANT ALL ON TABLE "public"."eventos_agenda" TO "service_role";



GRANT ALL ON SEQUENCE "public"."eventos_agenda_numero_evento_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."eventos_agenda_numero_evento_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."eventos_agenda_numero_evento_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."gestiones_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."gestiones_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."gestiones_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."historial_instancias" TO "anon";
GRANT ALL ON TABLE "public"."historial_instancias" TO "authenticated";
GRANT ALL ON TABLE "public"."historial_instancias" TO "service_role";



GRANT ALL ON SEQUENCE "public"."historial_instancias_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."historial_instancias_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."historial_instancias_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."instancias_log" TO "anon";
GRANT ALL ON TABLE "public"."instancias_log" TO "authenticated";
GRANT ALL ON TABLE "public"."instancias_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."instancias_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."instancias_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."instancias_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."metas" TO "anon";
GRANT ALL ON TABLE "public"."metas" TO "authenticated";
GRANT ALL ON TABLE "public"."metas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."metas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."metas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."metas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notificaciones" TO "anon";
GRANT ALL ON TABLE "public"."notificaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."notificaciones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notificaciones_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notificaciones_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notificaciones_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."rubros" TO "anon";
GRANT ALL ON TABLE "public"."rubros" TO "authenticated";
GRANT ALL ON TABLE "public"."rubros" TO "service_role";



GRANT ALL ON TABLE "public"."rubros_evento" TO "anon";
GRANT ALL ON TABLE "public"."rubros_evento" TO "authenticated";
GRANT ALL ON TABLE "public"."rubros_evento" TO "service_role";



GRANT ALL ON TABLE "public"."rutas" TO "anon";
GRANT ALL ON TABLE "public"."rutas" TO "authenticated";
GRANT ALL ON TABLE "public"."rutas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rutas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rutas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rutas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sub_rubros" TO "anon";
GRANT ALL ON TABLE "public"."sub_rubros" TO "authenticated";
GRANT ALL ON TABLE "public"."sub_rubros" TO "service_role";



GRANT ALL ON TABLE "public"."tarea_completada" TO "anon";
GRANT ALL ON TABLE "public"."tarea_completada" TO "authenticated";
GRANT ALL ON TABLE "public"."tarea_completada" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tarea_completada_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tarea_completada_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tarea_completada_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tareas" TO "anon";
GRANT ALL ON TABLE "public"."tareas" TO "authenticated";
GRANT ALL ON TABLE "public"."tareas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tareas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tareas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tareas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tipos_evento" TO "anon";
GRANT ALL ON TABLE "public"."tipos_evento" TO "authenticated";
GRANT ALL ON TABLE "public"."tipos_evento" TO "service_role";



GRANT ALL ON TABLE "public"."tipos_resultado" TO "anon";
GRANT ALL ON TABLE "public"."tipos_resultado" TO "authenticated";
GRANT ALL ON TABLE "public"."tipos_resultado" TO "service_role";



GRANT ALL ON TABLE "public"."ubicaciones_ejecutivos" TO "anon";
GRANT ALL ON TABLE "public"."ubicaciones_ejecutivos" TO "authenticated";
GRANT ALL ON TABLE "public"."ubicaciones_ejecutivos" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Autenticados pueden ver fotos"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'gestiones-fotos'::text));



  create policy "Ejecutivos pueden subir fotos"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'gestiones-fotos'::text));



