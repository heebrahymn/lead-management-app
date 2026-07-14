-- Allow select from anon and authenticated users (needed for upsert conflict check)
CREATE POLICY "Enable select access for all"
ON public.meta_ads_metrics
FOR SELECT
USING (true);

-- Allow inserts from anon and authenticated users
CREATE POLICY "Enable insert access for all"
ON public.meta_ads_metrics
FOR INSERT
WITH CHECK (true);

-- Allow updates from anon and authenticated users (needed for upsert)
CREATE POLICY "Enable update access for all"
ON public.meta_ads_metrics
FOR UPDATE
USING (true)
WITH CHECK (true);
