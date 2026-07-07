-- Make lead status triggers safe against non-UUID auth.uid() values (e.g. 'service_role')
CREATE OR REPLACE FUNCTION public.log_initial_lead_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  current_user_id uuid;
BEGIN
  BEGIN
    current_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    current_user_id := NULL;
  END;

  INSERT INTO public.lead_status_history (lead_id, from_status, to_status, changed_by)
  VALUES (NEW.id, NULL, NEW.status, current_user_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_lead_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  current_user_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    BEGIN
      current_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
      current_user_id := NULL;
    END;

    INSERT INTO public.lead_status_history (lead_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, current_user_id);
  END IF;
  RETURN NEW;
END;
$$;
