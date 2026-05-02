-- Add assigned_to and followup_at to leads table
ALTER TABLE public.leads 
  ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN followup_at TIMESTAMPTZ;

-- Add an index for faster filtering and sorting
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_leads_followup_at ON public.leads(followup_at);
