-- Create the google_ads_metrics table
CREATE TABLE IF NOT EXISTS public.google_ads_metrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  campaign_name text NOT NULL,
  spend numeric NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  conversions numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Add a unique constraint so we don't accidentally insert duplicate campaign data for the same date
  UNIQUE(date, campaign_name)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.google_ads_metrics ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to select
CREATE POLICY "Enable read access for authenticated users" 
ON public.google_ads_metrics 
FOR SELECT 
TO authenticated 
USING (true);

-- Add indexes for fast querying by date
CREATE INDEX idx_google_ads_metrics_date ON public.google_ads_metrics(date);
CREATE INDEX idx_google_ads_metrics_campaign ON public.google_ads_metrics(campaign_name);
