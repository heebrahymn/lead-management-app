-- Ensure pg_cron and pg_net extensions are enabled
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. Daily Meta Ads Report (HTML + PDF Attachment) - Scheduled at 8:00 AM UTC (9:00 AM WAT)
select cron.schedule(
  'daily-meta-ads-report', 
  '0 8 * * *',            
  $$
    select net.http_post(
        url := 'https://gejmzlzuddwdipcromni.supabase.co/functions/v1/daily-meta-ads-report',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_2CjqTI8B_cnB5mzNLXo4AQ_i1Jaj1o_"}'::jsonb,
        body := '{}'::jsonb
    );
  $$
);

-- 2. Daily Google Ads Report (HTML + PDF Attachment) - Scheduled at 8:15 AM UTC (9:15 AM WAT)
select cron.schedule(
  'daily-google-ads-report', 
  '15 8 * * *',            
  $$
    select net.http_post(
        url := 'https://gejmzlzuddwdipcromni.supabase.co/functions/v1/daily-google-ads-report',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_2CjqTI8B_cnB5mzNLXo4AQ_i1Jaj1o_"}'::jsonb,
        body := '{}'::jsonb
    );
  $$
);

-- 3. Daily WhatsApp Report - Scheduled at 8:30 AM UTC (9:30 AM WAT)
select cron.schedule(
  'daily-whatsapp-report', 
  '30 8 * * *',            
  $$
    select net.http_post(
        url := 'https://gejmzlzuddwdipcromni.supabase.co/functions/v1/daily-whatsapp-report',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_2CjqTI8B_cnB5mzNLXo4AQ_i1Jaj1o_"}'::jsonb,
        body := '{}'::jsonb
    );
  $$
);
