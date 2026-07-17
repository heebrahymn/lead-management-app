INSERT INTO google_ads_metrics (date, campaign_name, spend, clicks, impressions, conversions)
VALUES
  ('2026-07-09', 'Search | Tyre & Wheel Alignment | Zambia 08JULY2626', 7.61, 1, 44, 0),
  ('2026-07-10', 'Search | Tyre & Wheel Alignment | Zambia 08JULY2626', 283.44, 40, 366, 17),
  ('2026-07-11', 'Search | Tyre & Wheel Alignment | Zambia 08JULY2626', 280.88, 44, 685, 43),
  ('2026-07-12', 'Search | Tyre & Wheel Alignment | Zambia 08JULY2626', 131.69, 23, 406, 25),
  ('2026-07-13', 'Search | Tyre & Wheel Alignment | Zambia 08JULY2626', 174.75, 61, 480, 23)
ON CONFLICT (date, campaign_name) 
DO UPDATE SET 
  spend = EXCLUDED.spend,
  clicks = EXCLUDED.clicks,
  impressions = EXCLUDED.impressions,
  conversions = EXCLUDED.conversions,
  updated_at = NOW();
