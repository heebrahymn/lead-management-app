-- Hardening RLS policies for leads and related tables

-- 1. Leads Table
DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON public.leads;

CREATE POLICY "Superadmins or Owners can update leads"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin') OR 
    auth.uid() = created_by OR 
    auth.uid() = assigned_to
  );

CREATE POLICY "Superadmins can delete leads"
  ON public.leads FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));


-- 2. Lead Notes Table
DROP POLICY IF EXISTS "Authenticated users can update notes" ON public.lead_notes;
DROP POLICY IF EXISTS "Authenticated users can delete notes" ON public.lead_notes;

CREATE POLICY "Superadmins or Owners can update notes"
  ON public.lead_notes FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin') OR 
    auth.uid() = created_by
  );

CREATE POLICY "Superadmins or Owners can delete notes"
  ON public.lead_notes FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin') OR 
    auth.uid() = created_by
  );


-- 3. WhatsApp Messages Table
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.whatsapp_messages;

CREATE POLICY "Superadmins can update whatsapp messages"
  ON public.whatsapp_messages FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmins can delete whatsapp messages"
  ON public.whatsapp_messages FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));


-- 4. User Roles Table (Reviewing existing)
-- Existing policies already restricted INSERT/UPDATE/DELETE to superadmins.
-- We will keep SELECT open for internal lookups.
