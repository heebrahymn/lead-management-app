-- Update PDF cron schedules to trigger at 8:30 AM UTC and 8:31 AM UTC

select cron.schedule(
  'daily-meta-ads-pdf-report', 
  '30 8 * * *',            
  $$
    select net.http_post(
        url := 'https://gejmzlzuddwdipcromni.supabase.co/functions/v1/daily-meta-ads-pdf-report',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_2CjqTI8B_cnB5mzNLXo4AQ_i1Jaj1o_"}'::jsonb,
        body := '{}'::jsonb
    );
  $$
);

select cron.schedule(
  'daily-google-ads-pdf-report', 
  '31 8 * * *',            
  $$
    select net.http_post(
        url := 'https://gejmzlzuddwdipcromni.supabase.co/functions/v1/daily-google-ads-pdf-report',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_2CjqTI8B_cnB5mzNLXo4AQ_i1Jaj1o_"}'::jsonb,
        body := '{}'::jsonb
    );
  $$
);
