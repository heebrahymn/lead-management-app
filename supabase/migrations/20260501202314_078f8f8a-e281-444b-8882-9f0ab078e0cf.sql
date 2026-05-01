-- Status enum
CREATE TYPE public.lead_status AS ENUM ('new', 'interested', 'no_response', 'converted', 'lost', 'closed');

-- Leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT,
  status public.lead_status NOT NULL DEFAULT 'new',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view leads"
  ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert leads"
  ON public.leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update leads"
  ON public.leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete leads"
  ON public.leads FOR DELETE TO authenticated USING (true);

-- Notes table
CREATE TABLE public.lead_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view notes"
  ON public.lead_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert notes"
  ON public.lead_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update notes"
  ON public.lead_notes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete notes"
  ON public.lead_notes FOR DELETE TO authenticated USING (true);

-- Status history table
CREATE TABLE public.lead_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_status public.lead_status,
  to_status public.lead_status NOT NULL,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view status history"
  ON public.lead_status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert status history"
  ON public.lead_status_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_updated_at ON public.leads(updated_at DESC);
CREATE INDEX idx_lead_notes_lead_id ON public.lead_notes(lead_id, created_at DESC);
CREATE INDEX idx_lead_status_history_lead_id ON public.lead_status_history(lead_id, created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-log status changes
CREATE OR REPLACE FUNCTION public.log_lead_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.lead_status_history (lead_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_lead_status_change
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_status_change();

-- Initial status history on insert
CREATE OR REPLACE FUNCTION public.log_initial_lead_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.lead_status_history (lead_id, from_status, to_status, changed_by)
  VALUES (NEW.id, NULL, NEW.status, auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_initial_lead_status
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_initial_lead_status();