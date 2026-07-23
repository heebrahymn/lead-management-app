-- Ensure pg_cron and pg_net extensions are enabled
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. Daily Meta Ads PDF Report - Scheduled at 8:00 AM UTC (9:00 AM WAT)
select cron.schedule(
  'daily-meta-ads-report', 
  '0 8 * * *',            
  $$
    select net.http_post(
        url := (select current_setting('app.settings.supabase_url', true)) || '/functions/v1/daily-meta-ads-report',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select current_setting('app.settings.cron_secret', true))
        ),
        body := '{}'::jsonb
    );
  $$
);

-- 2. Daily Google Ads PDF Report - Scheduled at 8:15 AM UTC (9:15 AM WAT)
select cron.schedule(
  'daily-google-ads-report', 
  '15 8 * * *',            
  $$
    select net.http_post(
        url := (select current_setting('app.settings.supabase_url', true)) || '/functions/v1/daily-google-ads-report',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select current_setting('app.settings.cron_secret', true))
        ),
        body := '{}'::jsonb
    );
  $$
);
