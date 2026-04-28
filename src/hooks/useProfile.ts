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

    supabase
      .from("profiles")
      .select("id, email, nombre, apellido, telefono, rol, activo, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error("Error cargando perfil:", error);
        setProfile(data ?? null);
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
