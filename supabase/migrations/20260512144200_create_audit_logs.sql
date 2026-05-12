-- 1. Create Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now() NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    table_name text NOT NULL,
    record_id uuid,
    old_data jsonb,
    new_data jsonb
);

-- 2. Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Enable Select permissions for authenticated users (requested: viewable by standard users)
CREATE POLICY "Allow all read access to audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (true);

-- Only system functions write here.

-- 4. The Trigger Function
CREATE OR REPLACE FUNCTION public.fn_audit_log_event()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id uuid;
BEGIN
    -- Retrieve user executing action from supabase context
    BEGIN
        current_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        current_user_id := NULL;
    END;

    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (user_id, action_type, table_name, record_id, old_data, new_data)
        VALUES (current_user_id, 'DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD)::jsonb, NULL);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (user_id, action_type, table_name, record_id, old_data, new_data)
        VALUES (current_user_id, 'UPDATE', TG_TABLE_NAME, NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (user_id, action_type, table_name, record_id, old_data, new_data)
        VALUES (current_user_id, 'INSERT', TG_TABLE_NAME, NEW.id, NULL, row_to_json(NEW)::jsonb);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Bind triggers to targeted tables
DROP TRIGGER IF EXISTS tr_audit_leads ON public.leads;
CREATE TRIGGER tr_audit_leads
AFTER INSERT OR UPDATE OR DELETE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_event();

DROP TRIGGER IF EXISTS tr_audit_notes ON public.lead_notes;
CREATE TRIGGER tr_audit_notes
AFTER INSERT OR UPDATE OR DELETE ON public.lead_notes
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_event();
