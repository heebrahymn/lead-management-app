-- Ensure pg_cron and pg_net are enabled
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Update Meta Ads report to 9:00 AM WAT (8:00 AM UTC)
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

-- Update Google Ads report to 9:15 AM WAT (8:15 AM UTC)
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

-- Update WhatsApp report to 9:30 AM WAT (8:30 AM UTC)
select cron.schedule(
  'daily-whatsapp-report', 
  '30 8 * * *',            
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
