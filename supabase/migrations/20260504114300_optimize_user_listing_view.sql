-- Create a view for efficient user management listing
-- This avoids multiple queries in the admin-create-user edge function

CREATE OR REPLACE VIEW public.user_details AS
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

-- Grant access to the service_role for edge functions
GRANT SELECT ON public.user_details TO service_role;
