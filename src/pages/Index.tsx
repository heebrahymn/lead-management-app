import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { AddLeadDialog } from "@/components/AddLeadDialog";
import { StatusPicker } from "@/components/StatusPicker";
import { Lead, LeadStatus, LeadSource, STATUSES, STATUS_LABEL, SOURCES, SOURCE_LABEL } from "@/lib/leads";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, Loader2, Mail, Phone, Download, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type SortKey = "updated_desc" | "updated_asc" | "name_asc" | "status";

export default function Index() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus[]>([]);
  const [sourceFilter, setSourceFilter] = useState<LeadSource[]>([]);
  const [sort, setSort] = useState<SortKey>("updated_desc");

  useEffect(() => {
    if (!authLoading && !session) navigate("/auth", { replace: true });
  }, [session, authLoading, navigate]);

  useEffect(() => {
    document.title = "Leadly — Lead Management";
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    else setLeads((data ?? []) as Lead[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!session) return;
    load();

    const channel = supabase
      .channel("leads-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const updateStatus = async (id: string, status: LeadStatus) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
    } else {
      toast.success("Status updated");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = leads.filter((l) => {
      if (statusFilter.length && !statusFilter.includes(l.status)) return false;
      if (sourceFilter.length && (!l.source || !sourceFilter.includes(l.source))) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        (l.phone ?? "").toLowerCase().includes(q) ||
        (l.source ?? "").toLowerCase().includes(q)
      );
    });
    const order: Record<LeadStatus, number> = {
      new: 0, interested: 1, no_response: 2, converted: 3, lost: 4, closed: 5,
    };
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "updated_asc":
          return +new Date(a.updated_at) - +new Date(b.updated_at);
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "status":
          return order[a.status] - order[b.status];
        default:
          return +new Date(b.updated_at) - +new Date(a.updated_at);
      }
    });
    return list;
  }, [leads, search, statusFilter, sourceFilter, sort]);

  const counts = useMemo(() => {
    const c: Record<LeadStatus, number> = {
      new: 0, interested: 0, no_response: 0, converted: 0, lost: 0, closed: 0,
    };
    leads.forEach((l) => { c[l.status]++; });
    return c;
  }, [leads]);

  const exportCsv = () => {
    const rows = [
      ["Name", "Email", "Phone", "Source", "Status", "Tags", "Created", "Updated"],
      ...filtered.map((l) => [
        l.name,
        l.email ?? "",
        l.phone ?? "",
        l.source ?? "",
        STATUS_LABEL[l.status],
        (l.tags ?? []).join("; "),
        l.created_at,
        l.updated_at,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || !session) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track every conversation from first contact to close.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <AddLeadDialog onCreated={load} />
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <StatCard label="Total" value={leads.length} accent />
          {STATUSES.map((s) => (
            <StatCard key={s.value} label={s.label} value={counts[s.value]} status={s.value} />
          ))}
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone, source…"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Status
                  {statusFilter.length > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                      {statusFilter.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUSES.map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s.value}
                    checked={statusFilter.includes(s.value)}
                    onCheckedChange={(checked) => {
                      setStatusFilter((prev) =>
                        checked ? [...prev, s.value] : prev.filter((x) => x !== s.value)
                      );
                    }}
                  >
                    {s.label}
                  </DropdownMenuCheckboxItem>
                ))}
                {statusFilter.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <button
                      onClick={() => setStatusFilter([])}
                      className="w-full px-2 py-1.5 text-left text-sm text-muted-foreground hover:text-foreground"
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Source
                  {sourceFilter.length > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                      {sourceFilter.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by source</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SOURCES.map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s.value}
                    checked={sourceFilter.includes(s.value)}
                    onCheckedChange={(checked) => {
                      setSourceFilter((prev) =>
                        checked ? [...prev, s.value] : prev.filter((x) => x !== s.value)
                      );
                    }}
                  >
                    {s.label}
                  </DropdownMenuCheckboxItem>
                ))}
                {sourceFilter.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <button
                      onClick={() => setSourceFilter([])}
                      className="w-full px-2 py-1.5 text-left text-sm text-muted-foreground hover:text-foreground"
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-[170px] gap-2">
                <ArrowUpDown className="h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_desc">Recently updated</SelectItem>
                <SelectItem value="updated_asc">Oldest update</SelectItem>
                <SelectItem value="name_asc">Name (A–Z)</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasLeads={leads.length > 0} onCreated={load} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
            <div className="hidden grid-cols-12 gap-4 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:grid">
              <div className="col-span-3">Name</div>
              <div className="col-span-3">Contact</div>
              <div className="col-span-2">Source</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Updated</div>
            </div>
            <ul className="divide-y divide-border">
              {filtered.map((lead) => (
                <li
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  className="grid cursor-pointer grid-cols-1 gap-2 px-4 py-3.5 transition hover:bg-muted/40 sm:grid-cols-12 sm:items-center sm:gap-4"
                >
                  <div className="col-span-3">
                    <div className="font-medium text-foreground">{lead.name}</div>
                  </div>
                  <div className="col-span-3 space-y-0.5 text-sm">
                    {lead.email && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{lead.phone}</span>
                      </div>
                    )}
                    {!lead.email && !lead.phone && (
                      <span className="text-xs text-muted-foreground">No contact info</span>
                    )}
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground">
                    {lead.source ? SOURCE_LABEL[lead.source] : "—"}
                  </div>
                  <div className="col-span-2">
                    <StatusPicker
                      status={lead.status}
                      onChange={(s) => updateStatus(lead.id, s)}
                    />
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  status,
}: {
  label: string;
  value: number;
  accent?: boolean;
  status?: LeadStatus;
}) {
  const dotMap: Record<LeadStatus, string> = {
    new: "bg-status-new-fg",
    interested: "bg-status-interested-fg",
    no_response: "bg-status-no-response-fg",
    converted: "bg-status-converted-fg",
    lost: "bg-status-lost-fg",
    closed: "bg-status-closed-fg",
  };
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3.5 shadow-soft transition",
        accent ? "border-primary/30 bg-primary-muted" : "border-border"
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {status && <span className={cn("h-1.5 w-1.5 rounded-full", dotMap[status])} />}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function EmptyState({ hasLeads, onCreated }: { hasLeads: boolean; onCreated: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-muted text-primary">
        <Search className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold">
        {hasLeads ? "No matching leads" : "No leads yet"}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasLeads
          ? "Try changing your search or clearing filters."
          : "Add your first lead to start tracking conversations."}
      </p>
      {!hasLeads && (
        <div className="mt-4">
          <AddLeadDialog onCreated={onCreated} />
        </div>
      )}
    </div>
  );
}
