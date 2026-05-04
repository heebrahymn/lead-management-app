-- Broadening update permissions for leads and notes as requested

-- 1. Leads Table: Allow all authenticated users to update, but keep delete restricted to superadmins
DROP POLICY IF EXISTS "Superadmins or Owners can update leads" ON public.leads;

CREATE POLICY "All authenticated users can update leads"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (true);

-- 2. Lead Notes Table: Allow all authenticated users to update
DROP POLICY IF EXISTS "Superadmins or Owners can update notes" ON public.lead_notes;

CREATE POLICY "All authenticated users can update notes"
  ON public.lead_notes FOR UPDATE
  TO authenticated
  USING (true);
