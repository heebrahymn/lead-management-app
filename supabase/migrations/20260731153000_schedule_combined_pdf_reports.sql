-- Ensure pg_cron and pg_net extensions are enabled
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Master Combined 3-in-1 Daily PDF Report (Meta, Google, WhatsApp) - Scheduled at 8:30 AM UTC (9:30 AM WAT)
select cron.schedule(
  'daily-pdf-reports', 
  '30 8 * * *',            
  $$
    select net.http_post(
        url := 'https://gejmzlzuddwdipcromni.supabase.co/functions/v1/daily-pdf-reports',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_2CjqTI8B_cnB5mzNLXo4AQ_i1Jaj1o_"}'::jsonb,
        body := '{}'::jsonb
    );
  $$
);
