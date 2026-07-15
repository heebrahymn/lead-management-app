-- meta_ads_metrics
CREATE OR REPLACE FUNCTION upsert_meta_ads_metrics()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.meta_ads_metrics
    SET 
        spend = NEW.spend,
        impressions = NEW.impressions,
        reach = NEW.reach,
        clicks = NEW.clicks,
        whatsapp_clicks = NEW.whatsapp_clicks,
        cpm = NEW.cpm
    WHERE date = NEW.date AND campaign_name = NEW.campaign_name;

    IF FOUND THEN
        RETURN NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_upsert_meta_ads_metrics ON public.meta_ads_metrics;
CREATE TRIGGER trg_upsert_meta_ads_metrics
BEFORE INSERT ON public.meta_ads_metrics
FOR EACH ROW
EXECUTE FUNCTION upsert_meta_ads_metrics();

-- google_ads_metrics
CREATE OR REPLACE FUNCTION upsert_google_ads_metrics()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.google_ads_metrics
    SET 
        spend = NEW.spend,
        clicks = NEW.clicks,
        impressions = NEW.impressions,
        conversions = NEW.conversions
    WHERE date = NEW.date AND campaign_name = NEW.campaign_name;

    IF FOUND THEN
        RETURN NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_upsert_google_ads_metrics ON public.google_ads_metrics;
CREATE TRIGGER trg_upsert_google_ads_metrics
BEFORE INSERT ON public.google_ads_metrics
FOR EACH ROW
EXECUTE FUNCTION upsert_google_ads_metrics();

-- google_ads_conversion_actions
CREATE OR REPLACE FUNCTION upsert_google_ads_conversion_actions()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.google_ads_conversion_actions
    SET 
        conversions = NEW.conversions
    WHERE date = NEW.date AND campaign_name = NEW.campaign_name AND action_name = NEW.action_name;

    IF FOUND THEN
        RETURN NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_upsert_google_ads_conversion_actions ON public.google_ads_conversion_actions;
CREATE TRIGGER trg_upsert_google_ads_conversion_actions
BEFORE INSERT ON public.google_ads_conversion_actions
FOR EACH ROW
EXECUTE FUNCTION upsert_google_ads_conversion_actions();
