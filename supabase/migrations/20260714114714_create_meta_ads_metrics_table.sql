-- Create the meta_ads_metrics table
CREATE TABLE IF NOT EXISTS public.meta_ads_metrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  campaign_name text NOT NULL,
  spend numeric NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  reach integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  whatsapp_clicks integer NOT NULL DEFAULT 0,
  cpm numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Prevent duplicate campaign data for the same date
  UNIQUE(date, campaign_name)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.meta_ads_metrics ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to select
CREATE POLICY "Enable read access for authenticated users" 
ON public.meta_ads_metrics 
FOR SELECT 
TO authenticated 
USING (true);

-- Add indexes for fast querying by date and campaign
CREATE INDEX idx_meta_ads_metrics_date ON public.meta_ads_metrics(date);
CREATE INDEX idx_meta_ads_metrics_campaign ON public.meta_ads_metrics(campaign_name);
