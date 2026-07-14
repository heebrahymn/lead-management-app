-- Create the google_ads_conversion_actions table
CREATE TABLE IF NOT EXISTS public.google_ads_conversion_actions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  campaign_name text NOT NULL,
  action_name text NOT NULL,
  conversions numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Add a unique constraint so we don't insert duplicate action data for the same campaign on the same date
  UNIQUE(date, campaign_name, action_name)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.google_ads_conversion_actions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to select
CREATE POLICY "Enable read access for authenticated users" 
ON public.google_ads_conversion_actions 
FOR SELECT 
TO authenticated 
USING (true);

-- Add indexes for fast querying
CREATE INDEX idx_google_ads_conversion_actions_date ON public.google_ads_conversion_actions(date);
CREATE INDEX idx_google_ads_conversion_actions_campaign ON public.google_ads_conversion_actions(campaign_name);
