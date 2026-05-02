import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { LeadFormDialog } from "@/components/AddLeadDialog";
import { StatusPicker } from "@/components/StatusPicker";
import { StatusBadge } from "@/components/StatusBadge";
import { Lead, LeadStatus, STATUSES, STATUS_LABEL, SOURCES, SOURCE_LABEL, ManagedUser } from "@/lib/leads";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Search, Filter, Loader2, Mail, Phone, Download, ArrowUpDown, Calendar, User, Eye, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type SortKey = "updated_desc" | "updated_asc" | "name_asc" | "status";

export default function Index() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [assignFilter, setAssignFilter] = useState<string[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [sort, setSort] = useState<SortKey>("updated_desc");

  useEffect(() => {
    if (!authLoading && !session) navigate("/auth", { replace: true });
  }, [session, authLoading, navigate]);

  useEffect(() => {
    document.title = "Leadly — Lead Management";
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) toast.error(error.message);
      else setLeads((data ?? []) as Lead[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    load();
    loadUsers();

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
  }, [session]);

  const loadUsers = async () => {
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { action: "list" },
    });
    if (!error && data?.users) {
      setUsers(data.users);
    }
  };

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
      if (sourceFilter.length && !sourceFilter.includes(l.source ?? "")) return false;
      if (assignFilter.length && !assignFilter.includes(l.assigned_to ?? "unassigned")) return false;
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
  }, [leads, search, statusFilter, sort, assignFilter, sourceFilter]);

  const { counts, pipelineValue } = useMemo(() => {
    const c: Record<LeadStatus, number> = {
      new: 0, interested: 0, no_response: 0, converted: 0, lost: 0, closed: 0,
    };
    let totalValue = 0;
    leads.forEach((l) => { 
      if (l.status && c[l.status] !== undefined) {
        c[l.status]++; 
      }
      totalValue += Number(l.deal_value || 0);
    });
    return { counts: c, pipelineValue: totalValue };
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
            <LeadFormDialog onSuccess={load} />
          </div>
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
                  <User className="h-4 w-4" />
                  Team Member
                  {assignFilter.length > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                      {assignFilter.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Filter by team member</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={assignFilter.includes("unassigned")}
                  onCheckedChange={(checked) => {
                    setAssignFilter((prev) =>
                      checked ? [...prev, "unassigned"] : prev.filter((x) => x !== "unassigned")
                    );
                  }}
                >
                  Unassigned
                </DropdownMenuCheckboxItem>
                {users.map((u) => (
                  <DropdownMenuCheckboxItem
                    key={u.id}
                    checked={assignFilter.includes(u.id)}
                    onCheckedChange={(checked) => {
                      setAssignFilter((prev) =>
                        checked ? [...prev, u.id] : prev.filter((x) => x !== u.id)
                      );
                    }}
                  >
                    <span className="truncate">{u.full_name || u.email}</span>
                  </DropdownMenuCheckboxItem>
                ))}
                {assignFilter.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <button
                      onClick={() => setAssignFilter([])}
                      className="w-full px-2 py-1.5 text-left text-sm text-muted-foreground hover:text-foreground"
                    >
                      Clear team filters
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
                    key={s}
                    checked={sourceFilter.includes(s)}
                    onCheckedChange={(checked) => {
                      setSourceFilter((prev) =>
                        checked ? [...prev, s] : prev.filter((x) => x !== s)
                      );
                    }}
                  >
                    {SOURCE_LABEL[s]}
                  </DropdownMenuCheckboxItem>
                ))}
                {sourceFilter.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <button
                      onClick={() => setSourceFilter([])}
                      className="w-full px-2 py-1.5 text-left text-sm text-muted-foreground hover:text-foreground"
                    >
                      Clear sources
                    </button>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

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
            <div className="hidden grid-cols-12 gap-6 border-b border-border bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 sm:grid">
              <div className="col-span-2">Contact</div>
              <div className="col-span-2">Phone</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1 text-center">Source</div>
              <div className="col-span-1">Assigned To</div>
              <div className="col-span-1">Follow-up</div>
              <div className="col-span-1 flex items-center gap-1">
                Value <ArrowUpDown className="h-3 w-3" />
              </div>
              <div className="col-span-1 flex items-center gap-1">
                Created <ArrowUpDown className="h-3 w-3" />
              </div>
              <div className="col-span-1 text-right">Actions</div>
            </div>
            <ul className="divide-y divide-border">
              {filtered.map((lead) => (
                <li
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  className="grid cursor-pointer grid-cols-1 gap-2 px-4 py-3.5 transition hover:bg-muted/40 sm:grid-cols-12 sm:items-center sm:gap-6"
                >
                  <div className="col-span-2">
                    <div className="font-bold text-[#6E3FF3] truncate text-sm">{lead.name}</div>
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground truncate">
                    {lead.phone || <span className="text-muted-foreground/40">—</span>}
                  </div>
                  <div className="col-span-1">
                    <StatusBadge status={lead.status} />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {lead.source ? (
                      <Badge variant="secondary" className="bg-blue-50 text-blue-600 hover:bg-blue-50 font-medium text-[10px] px-2 py-0.5 rounded-md border-none">
                        {SOURCE_LABEL[lead.source] || lead.source}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </div>
                  <div className="col-span-1 text-sm text-muted-foreground truncate">
                    {lead.assigned_to ? (
                      <span title={users.find(u => u.id === lead.assigned_to)?.email}>
                        {users.find(u => u.id === lead.assigned_to)?.full_name || users.find(u => u.id === lead.assigned_to)?.email?.split("@")[0] || "Unknown"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </div>
                  <div className="col-span-1">
                    {lead.followup_at ? (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-none font-medium text-[10px] px-2 py-0.5">
                        {format(new Date(lead.followup_at), "dd MMM")}
                      </Badge>
                    ) : (
                      <div className="text-muted-foreground/40 text-center">—</div>
                    )}
                  </div>
                  <div className="col-span-1 text-sm text-muted-foreground">
                    {lead.deal_value ? (
                      <span className="font-semibold text-foreground">£{Number(lead.deal_value).toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </div>
                  <div className="col-span-1 text-sm text-muted-foreground whitespace-nowrap">
                    {lead.created_at ? format(new Date(lead.created_at), "dd MMM") : "—"}
                  </div>
                  <div className="col-span-1 flex items-center justify-end gap-3 text-muted-foreground">
                    <button className="hover:text-foreground transition-colors">
                      <Eye className="h-4 w-4" />
                    </button>
                    <LeadFormDialog 
                      lead={lead} 
                      onSuccess={load} 
                      trigger={
                        <button 
                          className="hover:text-foreground transition-colors" 
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      }
                    />
                    <button className="hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
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
  value: string | number;
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
          <LeadFormDialog onSuccess={onCreated} />
        </div>
      )}
    </div>
  );
}
