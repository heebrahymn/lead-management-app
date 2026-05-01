import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { StatusPicker } from "@/components/StatusPicker";
import { StatusBadge } from "@/components/StatusBadge";
import { Lead, LeadNote, LeadStatus, StatusHistoryEntry, STATUS_LABEL } from "@/lib/leads";
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
  ArrowLeft, Loader2, Mail, Phone, Trash2, Send, X, Plus, Tag,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (!authLoading && !session) navigate("/auth", { replace: true });
  }, [session, authLoading, navigate]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: leadData, error: lErr }, { data: noteData }, { data: histData }] =
      await Promise.all([
        supabase.from("leads").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("lead_notes")
          .select("*")
          .eq("lead_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("lead_status_history")
          .select("*")
          .eq("lead_id", id)
          .order("created_at", { ascending: false }),
      ]);
    if (lErr) toast.error(lErr.message);
    setLead((leadData as Lead) ?? null);
    setNotes((noteData ?? []) as LeadNote[]);
    setHistory((histData ?? []) as StatusHistoryEntry[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!session || !id) return;
    load();
    const channel = supabase
      .channel(`lead-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_notes", filter: `lead_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_status_history", filter: `lead_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id]);

  useEffect(() => {
    document.title = lead ? `${lead.name} — Leadly` : "Lead — Leadly";
  }, [lead]);

  const updateStatus = async (status: LeadStatus) => {
    if (!lead) return;
    setLead({ ...lead, status });
    const { error } = await supabase.from("leads").update({ status }).eq("id", lead.id);
    if (error) toast.error(error.message);
    else toast.success("Status updated");
  };

  const updateField = async (field: "name" | "email" | "phone" | "source", value: string) => {
    if (!lead) return;
    const v = value.trim() || null;
    if ((lead as any)[field] === v) return;
    const payload: Partial<Pick<Lead, "name" | "email" | "phone" | "source">> = { [field]: v };
    const { error } = await supabase.from("leads").update(payload).eq("id", lead.id);
    if (error) toast.error(error.message);
  };

  const addNote = async () => {
    if (!lead || !noteText.trim()) return;
    setSavingNote(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("lead_notes").insert({
      lead_id: lead.id,
      content: noteText.trim(),
      created_by: userData.user?.id ?? null,
    });
    setSavingNote(false);
    if (error) { toast.error(error.message); return; }
    setNoteText("");
  };

  const addTag = async () => {
    const t = tagInput.trim();
    if (!t || !lead) return;
    if (lead.tags.includes(t)) { setTagInput(""); return; }
    const newTags = [...lead.tags, t];
    setLead({ ...lead, tags: newTags });
    setTagInput("");
    const { error } = await supabase.from("leads").update({ tags: newTags }).eq("id", lead.id);
    if (error) toast.error(error.message);
  };

  const removeTag = async (t: string) => {
    if (!lead) return;
    const newTags = lead.tags.filter((x) => x !== t);
    setLead({ ...lead, tags: newTags });
    const { error } = await supabase.from("leads").update({ tags: newTags }).eq("id", lead.id);
    if (error) toast.error(error.message);
  };

  const deleteLead = async () => {
    if (!lead) return;
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lead deleted");
    navigate("/", { replace: true });
  };

  if (authLoading || !session || loading) {
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

  return (
    <div>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          to="/leads"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All leads
        </Link>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <input
              defaultValue={lead.name}
              onBlur={(e) => updateField("name", e.target.value)}
              className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 -ml-2 text-3xl font-semibold tracking-tight outline-none transition hover:border-border focus:border-border focus:bg-card"
            />
            <div className="mt-2 flex items-center gap-3">
              <StatusPicker status={lead.status} onChange={updateStatus} size="md" />
              <span className="text-sm text-muted-foreground">
                Updated {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}
              </span>
            </div>
          </div>
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
                <AlertDialogAction onClick={deleteLead}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: details */}
          <section className="space-y-6 lg:col-span-2">
            {/* Note composer */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Log a note about this lead… (e.g., called, left voicemail)"
                rows={3}
                className="resize-none border-0 p-0 shadow-none focus-visible:ring-0"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    addNote();
                  }
                }}
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">⌘ + Enter to save</span>
                <Button size="sm" onClick={addNote} disabled={savingNote || !noteText.trim()} className="gap-1.5">
                  {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Add note
                </Button>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Activity
              </h3>
              {notes.length === 0 && history.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                  No activity yet.
                </p>
              ) : (
                <Timeline notes={notes} history={history} />
              )}
            </div>
          </section>

          {/* Right: meta */}
          <aside className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <h3 className="mb-3 text-sm font-semibold">Contact</h3>
              <dl className="space-y-3 text-sm">
                <FieldRow icon={<Mail className="h-3.5 w-3.5" />} label="Email">
                  <EditableField
                    value={lead.email ?? ""}
                    placeholder="—"
                    onSave={(v) => updateField("email", v)}
                  />
                </FieldRow>
                <FieldRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
                  <EditableField
                    value={lead.phone ?? ""}
                    placeholder="—"
                    onSave={(v) => updateField("phone", v)}
                  />
                </FieldRow>
                <FieldRow label="Source">
                  <EditableField
                    value={lead.source ?? ""}
                    placeholder="—"
                    onSave={(v) => updateField("source", v)}
                  />
                </FieldRow>
                <FieldRow label="Created">
                  <span className="text-foreground">
                    {format(new Date(lead.created_at), "MMM d, yyyy")}
                  </span>
                </FieldRow>
              </dl>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                <Tag className="h-3.5 w-3.5" /> Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
                  >
                    {t}
                    <button onClick={() => removeTag(t)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {lead.tags.length === 0 && (
                  <span className="text-xs text-muted-foreground">No tags yet</span>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  placeholder="Add tag…"
                  className="h-8 text-sm"
                />
                <Button size="sm" variant="outline" onClick={addTag} className="h-8 gap-1">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function FieldRow({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="flex w-20 shrink-0 items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </dt>
      <dd className="min-w-0 flex-1 text-sm">{children}</dd>
    </div>
  );
}

function EditableField({
  value,
  placeholder,
  onSave,
}: { value: string; placeholder?: string; onSave: (v: string) => void | Promise<void> }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onSave(v)}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 -ml-2 text-foreground outline-none transition hover:border-border focus:border-border focus:bg-background"
    />
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
              <p className="mt-2 text-xs text-muted-foreground">
                {format(new Date(item.at), "MMM d, yyyy 'at' h:mm a")}
              </p>
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
