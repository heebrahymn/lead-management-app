import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, User, Shield, Palette } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  useEffect(() => {
    document.title = "Settings — Leadly CRM";
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and workspace preferences.
        </p>
      </div>

      <div className="space-y-4">
        <Section icon={User} title="Account" description="Your profile information.">
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="User ID" value={user?.id ?? "—"} mono />
        </Section>

        <Section icon={Shield} title="Workspace" description="Shared team workspace.">
          <Row label="Visibility" value="All authenticated users see all leads" />
        </Section>

        <Section icon={Palette} title="Appearance" description="Theme preferences.">
          <Row label="Theme" value="System default" />
        </Section>

        <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Sign out</h3>
              <p className="text-xs text-muted-foreground">End your current session.</p>
            </div>
            <Button variant="outline" onClick={() => supabase.auth.signOut()} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-soft">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : "text-sm font-medium"}>{value}</span>
    </div>
  );
}
