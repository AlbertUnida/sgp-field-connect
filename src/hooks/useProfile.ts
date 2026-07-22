import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

export interface Profile {
  id: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  rol: "admin" | "ejecutivo" | "supervisor";
  area: "comercial" | "cobranzas" | "juridico";
  activo: boolean;
  avatar_url: string | null;
}

export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const CACHE_KEY = `sgp-cache-profile-${user.id}`;

    // Semilla desde cache para funcionar offline y evitar perfil null
    try {
      const cache = localStorage.getItem(CACHE_KEY);
      if (cache) setProfile(JSON.parse(cache));
    } catch { /* cache corrupto: ignorar */ }

    supabase
      .from("profiles")
      .select("id, email, nombre, apellido, telefono, rol, area, activo, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("Error cargando perfil:", error);
        if (data) {
          setProfile(data);
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* lleno: ignorar */ }
        }
        // Sin data (offline): conservar lo sembrado desde cache
        setLoading(false);
      })
      .then(undefined, () => {
        // La query lanzó (algunos errores de red rechazan en vez de resolver):
        // no pisar el cache ya sembrado; solo destrabar el loading.
        setLoading(false);
      });
  }, [user]);

  const nombreCompleto = profile
    ? [profile.nombre, profile.apellido].filter(Boolean).join(" ")
    : null;

  const isAdmin = profile?.rol === "admin";
  const isSupervisor = profile?.rol === "supervisor";
  // canManage: puede ver toda la cartera y los reportes del equipo (admin + supervisor)
  const canManage = isAdmin || isSupervisor;

  return {
    profile,
    loading,
    isAdmin,
    isSupervisor,
    canManage,
    nombreCompleto,
  };
};
