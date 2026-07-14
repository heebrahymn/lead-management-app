


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'superadmin',
    'standard',
    'operator'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."lead_source" AS ENUM (
    'call',
    'whatsapp',
    'email',
    'walk-in',
    'existing'
);


ALTER TYPE "public"."lead_source" OWNER TO "postgres";


CREATE TYPE "public"."lead_status" AS ENUM (
    'new',
    'interested',
    'no_response',
    'converted',
    'lost',
    'closed'
);


ALTER TYPE "public"."lead_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_audit_log_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_audit_log_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_initial_lead_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."log_initial_lead_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_lead_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."log_lead_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "action_type" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_ads_conversion_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "campaign_name" "text" NOT NULL,
    "action_name" "text" NOT NULL,
    "conversions" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."google_ads_conversion_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_ads_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "campaign_name" "text" NOT NULL,
    "spend" numeric DEFAULT 0 NOT NULL,
    "clicks" integer DEFAULT 0 NOT NULL,
    "impressions" integer DEFAULT 0 NOT NULL,
    "conversions" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."google_ads_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "from_status" "public"."lead_status",
    "to_status" "public"."lead_status" NOT NULL,
    "changed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "source" "public"."lead_source",
    "status" "public"."lead_status" DEFAULT 'new'::"public"."lead_status" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_to" "uuid",
    "followup_at" timestamp with time zone,
    "company" "text",
    "city" "text",
    "service" "text",
    "reg_number" "text",
    "vehicle_model" "text",
    "notes" "text",
    "deal_value" numeric
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_details" WITH ("security_invoker"='false') AS
 SELECT "u"."id",
    "u"."email",
    "u"."created_at",
    "u"."last_sign_in_at",
    "p"."full_name",
    COALESCE("array_agg"("ur"."role") FILTER (WHERE ("ur"."role" IS NOT NULL)), '{}'::"public"."app_role"[]) AS "roles"
   FROM (("auth"."users" "u"
     LEFT JOIN "public"."profiles" "p" ON (("u"."id" = "p"."id")))
     LEFT JOIN "public"."user_roles" "ur" ON (("u"."id" = "ur"."user_id")))
  GROUP BY "u"."id", "u"."email", "u"."created_at", "u"."last_sign_in_at", "p"."full_name";


ALTER VIEW "public"."user_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wati_message_id" "text",
    "lead_id" "uuid",
    "sender_name" "text",
    "wa_id" "text" NOT NULL,
    "message_text" "text",
    "message_type" "text",
    "direction" "text" NOT NULL,
    "status" "text",
    "operator_name" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "whatsapp_messages_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"])))
);


ALTER TABLE "public"."whatsapp_messages" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_ads_conversion_actions"
    ADD CONSTRAINT "google_ads_conversion_actions_date_campaign_name_action_nam_key" UNIQUE ("date", "campaign_name", "action_name");



ALTER TABLE ONLY "public"."google_ads_conversion_actions"
    ADD CONSTRAINT "google_ads_conversion_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_ads_metrics"
    ADD CONSTRAINT "google_ads_metrics_date_campaign_name_key" UNIQUE ("date", "campaign_name");



ALTER TABLE ONLY "public"."google_ads_metrics"
    ADD CONSTRAINT "google_ads_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_notes"
    ADD CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_status_history"
    ADD CONSTRAINT "lead_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_google_ads_conversion_actions_campaign" ON "public"."google_ads_conversion_actions" USING "btree" ("campaign_name");



CREATE INDEX "idx_google_ads_conversion_actions_date" ON "public"."google_ads_conversion_actions" USING "btree" ("date");



CREATE INDEX "idx_google_ads_metrics_campaign" ON "public"."google_ads_metrics" USING "btree" ("campaign_name");



CREATE INDEX "idx_google_ads_metrics_date" ON "public"."google_ads_metrics" USING "btree" ("date");



CREATE INDEX "idx_lead_notes_lead_id" ON "public"."lead_notes" USING "btree" ("lead_id", "created_at" DESC);



CREATE INDEX "idx_lead_status_history_lead_id" ON "public"."lead_status_history" USING "btree" ("lead_id", "created_at" DESC);



CREATE INDEX "idx_leads_assigned_to" ON "public"."leads" USING "btree" ("assigned_to");



CREATE INDEX "idx_leads_city" ON "public"."leads" USING "btree" ("city");



CREATE INDEX "idx_leads_company" ON "public"."leads" USING "btree" ("company");



CREATE INDEX "idx_leads_deal_value" ON "public"."leads" USING "btree" ("deal_value");



CREATE INDEX "idx_leads_followup_at" ON "public"."leads" USING "btree" ("followup_at");



CREATE INDEX "idx_leads_reg_number" ON "public"."leads" USING "btree" ("reg_number");



CREATE INDEX "idx_leads_service" ON "public"."leads" USING "btree" ("service");



CREATE INDEX "idx_leads_status" ON "public"."leads" USING "btree" ("status");



CREATE INDEX "idx_leads_updated_at" ON "public"."leads" USING "btree" ("updated_at" DESC);



CREATE OR REPLACE TRIGGER "tr_audit_leads" AFTER INSERT OR DELETE OR UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."fn_audit_log_event"();



CREATE OR REPLACE TRIGGER "tr_audit_notes" AFTER INSERT OR DELETE OR UPDATE ON "public"."lead_notes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_audit_log_event"();



CREATE OR REPLACE TRIGGER "trg_log_initial_lead_status" AFTER INSERT ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."log_initial_lead_status"();



CREATE OR REPLACE TRIGGER "trg_log_lead_status_change" AFTER UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."log_lead_status_change"();



CREATE OR REPLACE TRIGGER "update_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_whatsapp_messages_updated_at" BEFORE UPDATE ON "public"."whatsapp_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_notes"
    ADD CONSTRAINT "lead_notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_status_history"
    ADD CONSTRAINT "lead_status_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



CREATE POLICY "All authenticated users can update leads" ON "public"."leads" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "All authenticated users can update notes" ON "public"."lead_notes" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Allow all read access to audit logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can view roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert leads" ON "public"."leads" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert notes" ON "public"."lead_notes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert status history" ON "public"."lead_status_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can view leads" ON "public"."leads" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view notes" ON "public"."lead_notes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view status history" ON "public"."lead_status_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable insert access for authenticated users" ON "public"."whatsapp_messages" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for authenticated users" ON "public"."google_ads_conversion_actions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "public"."google_ads_metrics" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "public"."whatsapp_messages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Superadmins can delete leads" ON "public"."leads" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'superadmin'::"public"."app_role"));



CREATE POLICY "Superadmins can delete roles" ON "public"."user_roles" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'superadmin'::"public"."app_role"));



CREATE POLICY "Superadmins can delete whatsapp messages" ON "public"."whatsapp_messages" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'superadmin'::"public"."app_role"));



CREATE POLICY "Superadmins can insert roles" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'superadmin'::"public"."app_role"));



CREATE POLICY "Superadmins can manage all profiles" ON "public"."profiles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'superadmin'::"public"."app_role"));



CREATE POLICY "Superadmins can update roles" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'superadmin'::"public"."app_role"));



CREATE POLICY "Superadmins can update whatsapp messages" ON "public"."whatsapp_messages" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'superadmin'::"public"."app_role"));



CREATE POLICY "Superadmins or Owners can delete notes" ON "public"."lead_notes" FOR DELETE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'superadmin'::"public"."app_role") OR ("auth"."uid"() = "created_by")));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_ads_conversion_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_ads_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_messages" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."fn_audit_log_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_audit_log_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_audit_log_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_initial_lead_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_initial_lead_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_initial_lead_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_lead_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_lead_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_lead_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."google_ads_conversion_actions" TO "anon";
GRANT ALL ON TABLE "public"."google_ads_conversion_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."google_ads_conversion_actions" TO "service_role";



GRANT ALL ON TABLE "public"."google_ads_metrics" TO "anon";
GRANT ALL ON TABLE "public"."google_ads_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."google_ads_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."lead_notes" TO "anon";
GRANT ALL ON TABLE "public"."lead_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_notes" TO "service_role";



GRANT ALL ON TABLE "public"."lead_status_history" TO "anon";
GRANT ALL ON TABLE "public"."lead_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_details" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_messages" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_messages" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































