-- Update pg_cron jobs to use a longer timeout (30 seconds) to prevent pg_net from killing the request if the SMTP server is slow.
-- We also ensure the explicit URL and anon key are used.

-- Update Meta Ads report to 9:00 AM WAT (8:00 AM UTC)
select cron.schedule(
  'daily-meta-ads-report', 
  '0 8 * * *',            
  $$
    select net.http_post(
        url := 'https://gejmzlzuddwdipcromni.supabase.co/functions/v1/daily-meta-ads-report',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_2CjqTI8B_cnB5mzNLXo4AQ_i1Jaj1o_"}'::jsonb,
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
    );
  $$
);

-- Update Google Ads report to 9:15 AM WAT (8:15 AM UTC)
select cron.schedule(
  'daily-google-ads-report', 
  '15 8 * * *',            
  $$
    select net.http_post(
        url := 'https://gejmzlzuddwdipcromni.supabase.co/functions/v1/daily-google-ads-report',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_2CjqTI8B_cnB5mzNLXo4AQ_i1Jaj1o_"}'::jsonb,
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
    );
  $$
);

-- Update WhatsApp report to 9:30 AM WAT (8:30 AM UTC)
select cron.schedule(
  'daily-whatsapp-report', 
  '30 8 * * *',            
  $$
    select net.http_post(
        url := 'https://gejmzlzuddwdipcromni.supabase.co/functions/v1/daily-whatsapp-report',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_2CjqTI8B_cnB5mzNLXo4AQ_i1Jaj1o_"}'::jsonb,
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
    );
  $$
);
