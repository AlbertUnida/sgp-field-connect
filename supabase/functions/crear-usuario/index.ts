// Edge Function: crear-usuario
// Crea un nuevo usuario auth + perfil usando service_role.
// Solo admins y supervisors pueden invocarla.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Verificar sesión del caller ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "No autorizado" }, 401);
    }

    // Cliente admin (service_role) — operaciones privilegiadas
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Cliente con el JWT del caller para verificar identidad
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user: callerUser }, error: authErr } = await caller.auth.getUser();
    if (authErr || !callerUser) {
      return json({ error: "Sesión inválida" }, 401);
    }

    // ── 2. Verificar que el caller es admin o supervisor ──
    const { data: callerProfile, error: profileErr } = await admin
      .from("profiles")
      .select("rol")
      .eq("id", callerUser.id)
      .single();

    if (profileErr || !callerProfile) {
      return json({ error: "No se pudo verificar el perfil del caller" }, 403);
    }

    if (!["admin", "supervisor"].includes(callerProfile.rol)) {
      return json({ error: "Solo admins y supervisores pueden crear usuarios" }, 403);
    }

    // ── 3. Parsear body ──
    const { email, password, nombre, apellido, rol, area } = await req.json();

    if (!email || !password || !nombre || !rol) {
      return json({ error: "Faltan campos obligatorios: email, password, nombre, rol" }, 400);
    }

    if (password.length < 8) {
      return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
    }

    const rolesPermitidos = ["ejecutivo", "supervisor", "admin"];
    if (!rolesPermitidos.includes(rol)) {
      return json({ error: `Rol inválido: ${rol}` }, 400);
    }

    const areasPermitidas = ["comercial", "cobranzas", "juridico"];
    const areaFinal = area ?? "comercial";
    if (!areasPermitidas.includes(areaFinal)) {
      return json({ error: `Área inválida: ${area}` }, 400);
    }

    // Supervisores no pueden crear admins
    if (callerProfile.rol === "supervisor" && rol === "admin") {
      return json({ error: "Supervisores no pueden crear usuarios admin" }, 403);
    }

    // ── 4. Crear usuario auth con service_role (sin email de confirmación) ──
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // Confirma automáticamente, no requiere click en email
      user_metadata: { full_name: `${nombre} ${apellido ?? ""}`.trim() },
    });

    if (createErr) {
      // Mensaje amigable para email duplicado
      if (createErr.message.includes("already been registered") || createErr.message.includes("already registered")) {
        return json({ error: "Este email ya está registrado en el sistema" }, 409);
      }
      return json({ error: createErr.message }, 400);
    }

    // ── 5. Guardar perfil vía RPC SECURITY DEFINER ──
    const { error: rpcErr } = await admin.rpc("admin_set_user_profile", {
      target_user_id: created.user.id,
      p_nombre: nombre.trim(),
      p_apellido: apellido?.trim() || null,
      p_rol: rol,
      p_email: email.trim().toLowerCase(),
      p_area: areaFinal,
    });

    if (rpcErr) {
      console.error("Error al guardar perfil:", rpcErr);
      // Usuario creado pero sin perfil — advertir pero no fallar
      return json({
        user_id: created.user.id,
        warning: `Usuario creado pero el perfil no se configuró: ${rpcErr.message}`,
      }, 207);
    }

    return json({ user_id: created.user.id, ok: true });

  } catch (err) {
    console.error("Error inesperado:", err);
    return json({ error: "Error interno del servidor" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
