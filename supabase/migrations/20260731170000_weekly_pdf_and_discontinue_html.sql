-- Ensure pg_cron and pg_net extensions are enabled
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. Discontinue / Unschedule all HTML Email Reports
select cron.unschedule('daily-meta-ads-report') where exists (select 1 from cron.job where jobname = 'daily-meta-ads-report');
select cron.unschedule('daily-google-ads-report') where exists (select 1 from cron.job where jobname = 'daily-google-ads-report');
select cron.unschedule('daily-whatsapp-report') where exists (select 1 from cron.job where jobname = 'daily-whatsapp-report');

-- 2. Unschedule old daily 3-in-1 PDF job name if it exists
select cron.unschedule('daily-pdf-reports') where exists (select 1 from cron.job where jobname = 'daily-pdf-reports');

-- 3. Schedule Weekly 3-in-1 PDF Email Report (Meta, Google, WhatsApp) — Every Monday at 8:00 AM UTC (9:00 AM WAT)
select cron.schedule(
  'weekly-pdf-reports', 
  '0 8 * * 1',            
  $$
    select net.http_post(
        url := 'https://gejmzlzuddwdipcromni.supabase.co/functions/v1/daily-pdf-reports',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_2CjqTI8B_cnB5mzNLXo4AQ_i1Jaj1o_"}'::jsonb,
        body := '{}'::jsonb
    );
  $$
);

-- Note: Daily Yokohama PDF reports (daily-meta-ads-pdf-report & daily-google-ads-pdf-report) 
-- remain scheduled daily at 8:30 AM UTC & 8:31 AM UTC without spend data for Yokohama recipients.
