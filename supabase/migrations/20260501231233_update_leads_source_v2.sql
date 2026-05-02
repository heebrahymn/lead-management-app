-- Create the lead_source enum
CREATE TYPE public.lead_source AS ENUM ('call', 'whatsapp', 'email', 'walk-in', 'existing');

-- Clean up existing names (remove ' via whatsapp')
UPDATE public.leads 
SET name = TRIM(REPLACE(name, ' via whatsapp', ''))
WHERE name ILIKE '% via whatsapp%';

-- Alter the source column to use the enum
-- Note: We use 'CASE' to map existing text values if they exist, otherwise default to NULL or a specific value
ALTER TABLE public.leads 
  ALTER COLUMN source TYPE public.lead_source 
  USING (
    CASE 
      WHEN source ILIKE 'call' THEN 'call'::public.lead_source
      WHEN source ILIKE 'whatsapp' THEN 'whatsapp'::public.lead_source
      WHEN source ILIKE 'email' THEN 'email'::public.lead_source
      WHEN source ILIKE 'walk-in' THEN 'walk-in'::public.lead_source
      WHEN source ILIKE 'existing' THEN 'existing'::public.lead_source
      ELSE NULL 
    END
  );
