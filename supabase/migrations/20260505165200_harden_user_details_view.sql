-- Harden the user_details view to resolve Supabase Advisor security warnings
-- 1. Drop the existing insecure view
DROP VIEW IF EXISTS public.user_details;

-- 2. Recreate as SECURITY INVOKER (the secure default in Postgres 15+)
-- This ensures the view respects the permissions of the person querying it.
CREATE VIEW public.user_details AS
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.last_sign_in_at,
  p.full_name,
  COALESCE(
    array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), 
    '{}'
  ) as roles
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
GROUP BY u.id, u.email, u.created_at, u.last_sign_in_at, p.full_name;

-- 3. Explicitly revoke all permissions to start from a clean slate
REVOKE ALL ON public.user_details FROM PUBLIC;
REVOKE ALL ON public.user_details FROM anon;
REVOKE ALL ON public.user_details FROM authenticated;

-- 4. Grant SELECT only to service_role (for Edge Functions) 
-- and authenticated users (who will still be limited by their own permissions)
GRANT SELECT ON public.user_details TO service_role;
GRANT SELECT ON public.user_details TO authenticated;

-- NOTE: Because this is now a SECURITY INVOKER view, authenticated users 
-- will only see data if they have permission to view the underlying tables.
