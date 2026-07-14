CREATE POLICY "Enable select access for anon"
ON public.meta_ads_metrics
FOR SELECT
TO anon
USING (true);
