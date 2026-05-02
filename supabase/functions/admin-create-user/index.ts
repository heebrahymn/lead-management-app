import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const callerId = userData.user.id;

    const admin = createClient(url, serviceKey);

    const body = await req.json().catch(() => null);
    const action = body?.action ?? "list";

    if (action === "list") {
      const { data: list, error: listErr } =
        await admin.auth.admin.listUsers({ perPage: 200 });
      if (listErr) return json({ error: listErr.message }, 400);

      const { data: roles } = await admin.from("user_roles").select("user_id, role");
      const { data: profiles } = await admin.from("profiles").select("id, full_name");
      
      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });

      const profileMap = new Map<string, string>();
      (profiles ?? []).forEach((p: any) => {
        profileMap.set(p.id, p.full_name);
      });

      const users = list.users.map((u) => ({
        id: u.id,
        email: u.email,
        full_name: profileMap.get(u.id) ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        roles: roleMap.get(u.id) ?? [],
      }));
      return json({ users });
    }

    // All other actions require superadmin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "superadmin")
      .maybeSingle();

    if (!roleRow) {
      return json({ error: "Forbidden: superadmin only" }, 403);
    }

    if (action === "create") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      const password = String(body?.password ?? "");
      const role = String(body?.role ?? "standard");
      const fullName = String(body?.full_name ?? "").trim();

      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (createErr) return json({ error: createErr.message }, 400);

      await admin.from("user_roles").insert({ user_id: created.user.id, role });
      if (fullName) {
        await admin.from("profiles").insert({ id: created.user.id, full_name: fullName });
      }

      return json({ ok: true, user_id: created.user.id });
    }

    if (action === "update") {
      const targetId = String(body?.user_id ?? "");
      const newRole = body?.role;
      const newPassword = body?.password;
      const fullName = body?.full_name;

      if (!targetId) return json({ error: "user_id required" }, 400);

      if (newRole) {
        const { error: roleErr } = await admin
          .from("user_roles")
          .update({ role: newRole })
          .eq("user_id", targetId);
        
        if (roleErr || (await admin.from("user_roles").select("role").eq("user_id", targetId)).data?.length === 0) {
          // If no row exists or update failed, insert it
          await admin.from("user_roles").upsert({ user_id: targetId, role: newRole }, { onConflict: "user_id,role" });
        }
      }

      if (fullName !== undefined) {
        await admin.from("profiles").upsert({ id: targetId, full_name: fullName }, { onConflict: "id" });
      }

      if (newPassword) {
        if (newPassword.length < 6) {
          return json({ error: "Password must be at least 6 characters" }, 400);
        }
        const { error: passErr } = await admin.auth.admin.updateUserById(targetId, {
          password: newPassword,
        });
        if (passErr) return json({ error: passErr.message }, 400);
      }

      return json({ ok: true });
    }

    if (action === "delete") {
      const targetId = String(body?.user_id ?? "");
      if (!targetId) return json({ error: "user_id required" }, 400);
      if (targetId === callerId) {
        return json({ error: "Cannot delete yourself" }, 400);
      }
      const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
      if (delErr) return json({ error: delErr.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
