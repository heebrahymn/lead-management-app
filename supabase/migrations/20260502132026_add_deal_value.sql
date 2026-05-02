-- Add deal_value to leads table
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS deal_value NUMERIC(15, 2);

-- Add index for deal_value
CREATE INDEX IF NOT EXISTS idx_leads_deal_value ON public.leads(deal_value);
