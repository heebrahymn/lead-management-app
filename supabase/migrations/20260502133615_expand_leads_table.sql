-- Expand leads table with more fields
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS service TEXT,
  ADD COLUMN IF NOT EXISTS reg_number TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_model TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add indexes for commonly searched/filtered fields
CREATE INDEX IF NOT EXISTS idx_leads_company ON public.leads(company);
CREATE INDEX IF NOT EXISTS idx_leads_city ON public.leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_service ON public.leads(service);
CREATE INDEX IF NOT EXISTS idx_leads_reg_number ON public.leads(reg_number);
