-- Harden the user_details view to resolve Supabase Advisor security warnings
-- while maintaining functionality for the admin edge function.

-- 1. Drop the existing view
DROP VIEW IF EXISTS public.user_details;

-- 2. Recreate as SECURITY DEFINER
-- This is necessary to access auth.users from the public schema in Supabase.
CREATE OR REPLACE VIEW public.user_details 
WITH (security_invoker = false)
AS
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

-- 3. STRICT SECURITY: Revoke all public/authenticated access
REVOKE ALL ON public.user_details FROM PUBLIC;
REVOKE ALL ON public.user_details FROM anon;
REVOKE ALL ON public.user_details FROM authenticated;

-- 4. ONLY grant SELECT to service_role (for administrative Edge Functions)
GRANT SELECT ON public.user_details TO service_role;
