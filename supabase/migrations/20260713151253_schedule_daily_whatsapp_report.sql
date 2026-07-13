-- Ensure pg_cron and pg_net are enabled
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the daily WhatsApp report to run at 8:00 AM every day
-- We use pg_net to invoke the edge function. 
-- Make sure to replace the project URL and anon key with your actual production values or use secrets.
select cron.schedule(
  'daily-whatsapp-report', -- name of the cron job
  '0 8 * * *',             -- run at 8:00 AM every day
  $$
    select net.http_post(
        url := (select current_setting('app.settings.supabase_url', true)) || '/functions/v1/daily-whatsapp-report',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select current_setting('app.settings.cron_secret', true))
        ),
        body := '{}'::jsonb
    );
  $$
);
