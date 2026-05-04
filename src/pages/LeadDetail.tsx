import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRole";

import { StatusPicker } from "@/components/StatusPicker";
import { StatusBadge } from "@/components/StatusBadge";
import { LeadFormDialog } from "@/components/AddLeadDialog";
import { Lead, LeadNote, LeadStatus, StatusHistoryEntry, SOURCE_LABEL, ManagedUser } from "@/lib/leads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Loader2, Mail, Phone, Trash2, Send, X, Plus, Tag, Calendar, User, Pencil
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { isSuperadmin } = useRoles();
  
  const [noteText, setNoteText] = useState("");
  const [tagInput, setTagInput] = useState("");

  // Fetch Users
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { action: "list" },
      });
      if (error) throw error;
      return (data?.users || []) as ManagedUser[];
    },
  });

  const userMap = useMemo(() => {
    const map = new Map<string, ManagedUser>();
    users.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);

  // Fetch Lead Data
  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Lead;
    },
    enabled: !!id,
  });

  // Fetch Notes
  const { data: notes = [] } = useQuery({
    queryKey: ["lead-notes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_notes")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LeadNote[];
    },
    enabled: !!id,
  });

  // Fetch Status History
  const { data: history = [] } = useQuery({
    queryKey: ["lead-history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_status_history")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as StatusHistoryEntry[];
    },
    enabled: !!id,
  });

  // Real-time subscription
  useEffect(() => {
    if (!session || !id) return;
    const channel = supabase
      .channel(`lead-detail-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["lead", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_notes", filter: `lead_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["lead-notes", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_status_history", filter: `lead_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["lead-history", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, id, queryClient]);

  useEffect(() => {
    document.title = lead ? `${lead.name} — Leadly` : "Lead — Leadly";
  }, [lead]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<Lead>) => {
      const { error } = await supabase.from("leads").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("lead_notes").insert({
        lead_id: id,
        content: content.trim(),
        created_by: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNoteText("");
      toast.success("Note added");
      queryClient.invalidateQueries({ queryKey: ["lead-notes", id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!isSuperadmin) {
        throw new Error("You don't have permission to delete");
      }
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead deleted");
      navigate("/leads", { replace: true });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (leadLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-lg font-semibold">Lead not found</h2>
        <Link to="/leads" className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to leads
        </Link>
      </div>
    );
  }

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || lead.tags.includes(t)) { setTagInput(""); return; }
    updateMutation.mutate({ tags: [...lead.tags, t] });
    setTagInput("");
  };

  const removeTag = (t: string) => {
    updateMutation.mutate({ tags: lead.tags.filter((x) => x !== t) });
  };

  return (
    <div>
      <main className="mx-auto max-w-full px-4 py-8 sm:px-6">
        <Link
          to="/leads"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          All leads
        </Link>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between px-2">
          <div className="min-w-0 flex-1">
            <input
              defaultValue={lead.name}
              onBlur={(e) => updateMutation.mutate({ name: e.target.value })}
              className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 -ml-2 text-3xl font-bold tracking-tight outline-none transition hover:border-border focus:border-border focus:bg-card"
            />
            <div className="mt-2 flex items-center gap-3">
              <StatusPicker 
                status={lead.status} 
                onChange={(s) => updateMutation.mutate({ status: s })} 
                size="md" 
              />
              <span className="text-sm text-muted-foreground">
                Updated {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSuperadmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove {lead.name} and all associated notes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => {
                        deleteMutation.mutate();
                      }} 
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <LeadFormDialog
              lead={lead}
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ["lead", id] })}
              trigger={
                <Button variant="outline" size="sm" className="gap-2">
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              }
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 px-2">
          <aside className="space-y-6 lg:col-span-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Lead Information</h3>
              <dl className="space-y-4 text-sm">
                <FieldRow label="Value">
                  <span className="text-xl font-bold text-foreground">£{Number(lead.deal_value || 0).toLocaleString()}</span>
                </FieldRow>
                <FieldRow icon={<Mail className="h-3.5 w-3.5" />} label="Email">
                  <span className="font-medium">{lead.email || "—"}</span>
                </FieldRow>
                <FieldRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
                  <span className="font-medium">{lead.phone || "—"}</span>
                </FieldRow>
                <FieldRow label="Source">
                  <span className="font-medium">{lead.source ? SOURCE_LABEL[lead.source] : "—"}</span>
                </FieldRow>
                <FieldRow icon={<User className="h-3.5 w-3.5" />} label="Assignee">
                  <span className="font-medium">
                    {lead.assigned_to ? (userMap.get(lead.assigned_to)?.full_name || "Assigned") : "Unassigned"}
                  </span>
                </FieldRow>
                <FieldRow icon={<Calendar className="h-3.5 w-3.5" />} label="Follow-up">
                  <span className="font-medium">
                    {lead.followup_at ? format(new Date(lead.followup_at), "MMM d, yyyy") : "—"}
                  </span>
                </FieldRow>
              </dl>
            </div>
          </aside>

          <aside className="space-y-6 lg:col-span-4">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="mb-6 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Vehicle & Service</h3>
              <dl className="space-y-6 text-sm">
                <FieldRow label="Service">
                  <span className="font-medium">{lead.service || "—"}</span>
                </FieldRow>
                <FieldRow label="Reg No.">
                  <span className="font-bold uppercase text-primary bg-primary-muted px-2 py-0.5 rounded">{lead.reg_number || "—"}</span>
                </FieldRow>
              </dl>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="mb-6 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                <Tag className="h-3.5 w-3.5" /> Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                    {t}
                    <button onClick={() => removeTag(t)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTag()}
                  placeholder="Add tag…"
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" onClick={addTag} className="h-8 px-2">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </aside>

          <section className="space-y-6 lg:col-span-4">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Log a note..."
                rows={2}
                className="resize-none border-0 p-0 shadow-none focus-visible:ring-0"
                onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && addNoteMutation.mutate(noteText)}
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">⌘ + Enter to save</span>
                <Button 
                  size="sm" 
                  onClick={() => addNoteMutation.mutate(noteText)} 
                  disabled={addNoteMutation.isPending || !noteText.trim()} 
                  className="h-8 gap-1.5 bg-[#6E3FF3] hover:bg-[#5B34CC]"
                >
                  {addNoteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Add note
                </Button>
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Activity History</h3>
              <div className="pl-1">
                {notes.length === 0 && history.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  <Timeline notes={notes} history={history} />
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function FieldRow({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-start gap-4">
      <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
        {icon}{label}
      </dt>
      <dd className="min-w-0 flex-1 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

type TimelineItem =
  | { kind: "note"; at: string; data: LeadNote }
  | { kind: "status"; at: string; data: StatusHistoryEntry };

function Timeline({ notes, history }: { notes: LeadNote[]; history: StatusHistoryEntry[] }) {
  const items: TimelineItem[] = [
    ...notes.map((n) => ({ kind: "note" as const, at: n.created_at, data: n })),
    ...history.map((h) => ({ kind: "status" as const, at: h.created_at, data: h })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {items.map((item, idx) => (
        <li key={idx} className="relative">
          <span className="absolute -left-[27px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-background bg-muted-foreground/40" />
          {item.kind === "note" ? (
            <div className="rounded-lg border border-border bg-card p-3 shadow-soft">
              <p className="whitespace-pre-wrap text-sm text-foreground">{item.data.content}</p>
              <p className="mt-2 text-xs text-muted-foreground">{format(new Date(item.at), "MMM d, yyyy 'at' h:mm a")}</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Status changed</span>
              {item.data.from_status && (
                <>
                  <StatusBadge status={item.data.from_status} />
                  <span>→</span>
                </>
              )}
              <StatusBadge status={item.data.to_status} />
              <span className="text-xs">· {format(new Date(item.at), "MMM d, h:mm a")}</span>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
