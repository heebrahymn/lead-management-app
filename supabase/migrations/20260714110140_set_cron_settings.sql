SELECT cron.unschedule('daily-whatsapp-report');

SELECT cron.schedule(
  'daily-whatsapp-report',
  '0 8 * * *',
  $$
    select net.http_post(
        url := 'https://gejmzlzuddwdipcromni.supabase.co/functions/v1/daily-whatsapp-report',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer my-super-secret-cron-key'
        ),
        body := '{}'::jsonb
    );
  $$
);
