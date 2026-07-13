-- Área / equipo de trabajo del usuario, independiente del rol (jerarquía).
--   rol  = ejecutivo | supervisor | admin   (qué permisos tiene)
--   area = comercial | cobranzas | juridico  (en qué cartera trabaja)
-- Así se puede tener "Supervisor de Cobranzas", "Ejecutivo Comercial", etc.
-- Los usuarios existentes quedan en 'comercial' (default).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS area text NOT NULL DEFAULT 'comercial';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_area_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_area_check
  CHECK (area = ANY (ARRAY['comercial', 'cobranzas', 'juridico']));

-- admin_set_user_profile: agrega p_area. Cambia la firma → DROP + CREATE.
DROP FUNCTION IF EXISTS public.admin_set_user_profile(uuid, text, text, text, text);

CREATE FUNCTION public.admin_set_user_profile(
  target_user_id uuid,
  p_nombre       text,
  p_apellido     text,
  p_rol          text,
  p_email        text,
  p_area         text DEFAULT 'comercial'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  calling_role TEXT;
BEGIN
  -- Solo admins y supervisores pueden llamar (auth.uid() null = service_role, se permite)
  SELECT rol INTO calling_role FROM profiles WHERE id = auth.uid();
  IF auth.uid() IS NOT NULL AND calling_role NOT IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_rol = 'admin' AND calling_role IS NOT NULL AND calling_role <> 'admin' THEN
    RAISE EXCEPTION 'Solo un admin puede asignar el rol admin';
  END IF;

  INSERT INTO profiles (id, nombre, apellido, rol, email, area, activo)
  VALUES (target_user_id, p_nombre, p_apellido, p_rol, p_email, COALESCE(p_area, 'comercial'), true)
  ON CONFLICT (id) DO UPDATE SET
    nombre   = EXCLUDED.nombre,
    apellido = EXCLUDED.apellido,
    rol      = EXCLUDED.rol,
    email    = COALESCE(EXCLUDED.email, profiles.email),
    area     = EXCLUDED.area,
    activo   = true;
END;
$$;

ALTER FUNCTION public.admin_set_user_profile(uuid, text, text, text, text, text) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.admin_set_user_profile(uuid, text, text, text, text, text)
  TO anon, authenticated, service_role;
