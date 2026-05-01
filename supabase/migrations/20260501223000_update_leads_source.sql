-- Create the lead_source enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_source') THEN
        CREATE TYPE public.lead_source AS ENUM ('call', 'whatsapp', 'email', 'walk-in', 'existing');
    END IF;
END $$;

-- Clean up existing names (remove " via whatsapp" case-insensitively)
UPDATE public.leads
SET name = REGEXP_REPLACE(name, ' via whatsapp$', '', 'i')
WHERE name ~* ' via whatsapp$';

-- Update source column to use the enum
-- First, normalize existing values to match enum values, mapping others to NULL or 'existing'
UPDATE public.leads
SET source = CASE 
    WHEN LOWER(source) IN ('call', 'phone') THEN 'call'
    WHEN LOWER(source) = 'whatsapp' THEN 'whatsapp'
    WHEN LOWER(source) IN ('email', 'mail') THEN 'email'
    WHEN LOWER(source) IN ('walk-in', 'walkin') THEN 'walk-in'
    WHEN LOWER(source) = 'existing' THEN 'existing'
    ELSE NULL
END;

-- Alter the column type
ALTER TABLE public.leads 
  ALTER COLUMN source TYPE public.lead_source USING source::public.lead_source;
