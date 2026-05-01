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

    // Verify caller is superadmin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "superadmin")
      .maybeSingle();

    if (!roleRow) {
      return json({ error: "Forbidden: superadmin only" }, 403);
    }

    const body = await req.json().catch(() => null);
    const action = body?.action ?? "create";

    if (action === "create") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      const password = String(body?.password ?? "");
      const role = (body?.role ?? "standard") as "standard" | "superadmin";

      if (!email || !password || password.length < 6) {
        return json({ error: "Valid email and password (min 6 chars) required" }, 400);
      }
      if (role !== "standard" && role !== "superadmin") {
        return json({ error: "Invalid role" }, 400);
      }

      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
      if (createErr || !created.user) {
        return json({ error: createErr?.message ?? "Create failed" }, 400);
      }

      const { error: roleErr } = await admin
        .from("user_roles")
        .insert({ user_id: created.user.id, role });
      if (roleErr) {
        return json({ error: roleErr.message }, 400);
      }

      return json({ ok: true, user_id: created.user.id });
    }

    if (action === "list") {
      const { data: list, error: listErr } =
        await admin.auth.admin.listUsers({ perPage: 200 });
      if (listErr) return json({ error: listErr.message }, 400);

      const { data: roles } = await admin.from("user_roles").select("user_id, role");
      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });

      const users = list.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        roles: roleMap.get(u.id) ?? [],
      }));
      return json({ users });
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
