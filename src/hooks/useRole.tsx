import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "superadmin" | "standard";

export function useRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setRoles((data ?? []).map((r: { role: string }) => r.role as AppRole));
        setLoading(false);
      });
  }, [user]);

  const isSuperadmin = !!roles?.includes("superadmin");
  return { roles, isSuperadmin, loading };
}
