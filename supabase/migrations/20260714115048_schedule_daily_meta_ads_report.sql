-- Ensure pg_cron and pg_net are enabled
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the daily Meta Ads report to run at 8:30 AM every day
-- Staggered 15 minutes after Google Ads report (8:15 AM)
select cron.schedule(
  'daily-meta-ads-report', -- name of the cron job
  '30 8 * * *',            -- run at 8:30 AM every day
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
