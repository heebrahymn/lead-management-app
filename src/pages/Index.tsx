import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRole";

import { LeadFormDialog } from "@/components/AddLeadDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { 
  Lead, 
  LeadStatus, 
  STATUSES, 
  SOURCE_LABEL, 
  SOURCES, 
  ManagedUser, 
  PAGE_SIZE_OPTIONS, 
  DEFAULT_PAGE_SIZE 
} from "@/lib/leads";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, Loader2, Download, User, Eye, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type SortKey = "updated_desc" | "updated_asc" | "name_asc" | "status";

export default function Index() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSuperadmin } = useRoles();
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [assignFilter, setAssignFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("updated_desc");
  const [page, setPage] = useState(0);
  
  // Persistent page size
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem("leads_page_size");
    return saved ? Number(saved) : DEFAULT_PAGE_SIZE;
  });

  useEffect(() => {
    document.title = "Leadly — Lead Management";
  }, []);

  // Real-time subscription
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel("leads-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["leads"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, queryClient]);

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
    enabled: !!session,
  });

  const userMap = useMemo(() => {
    const map = new Map<string, ManagedUser>();
    users.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);

  // Fetch Leads (Server-side paginated & sorted)
  const { data, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads", page, sort, pageSize],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("*", { count: "exact" });

      // Apply Sort
      switch (sort) {
        case "updated_asc": query = query.order("updated_at", { ascending: true }); break;
        case "name_asc": query = query.order("name", { ascending: true }); break;
        case "status": query = query.order("status", { ascending: true }); break;
        default: query = query.order("updated_at", { ascending: false }); break;
      }

      // Apply Pagination
      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { leads: (data || []) as Lead[], total: count || 0 };
    },
    enabled: !!session,
  });

  const dataLeads = data?.leads;
  const leads = useMemo(() => dataLeads || [], [dataLeads]);
  const totalLeads = data?.total || 0;
  const totalPages = Math.ceil(totalLeads / pageSize);

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: LeadStatus }) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error) => toast.error(error.message),
  });

  // Delete Lead Mutation
  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead deleted");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error) => toast.error(error.message),
  });

  // Local filtering (still useful for UI responsiveness on the current page)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
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
  }, [leads, search, statusFilter, assignFilter, sourceFilter]);

  const exportCsv = () => {
    const rows = [
      ["Name", "Email", "Phone", "Source", "Status", "Tags", "Created", "Updated"],
      ...leads.map((l) => [
        l.name,
        l.email ?? "",
        l.phone ?? "",
        l.source ?? "",
        l.status,
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

  const handlePageSizeChange = (val: string) => {
    const newSize = Number(val);
    setPageSize(newSize);
    setPage(0);
    localStorage.setItem("leads_page_size", val);
  };

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
            <LeadFormDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["leads"] })} />
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {/* Team Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <User className="h-4 w-4" />
                  Team
                  {assignFilter.length > 0 && <Badge variant="secondary" className="ml-1">{assignFilter.length}</Badge>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Filter by team</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={assignFilter.includes("unassigned")}
                  onCheckedChange={(checked) => setAssignFilter(prev => checked ? [...prev, "unassigned"] : prev.filter(x => x !== "unassigned"))}
                >
                  Unassigned
                </DropdownMenuCheckboxItem>
                {users.map((u) => (
                  <DropdownMenuCheckboxItem
                    key={u.id}
                    checked={assignFilter.includes(u.id)}
                    onCheckedChange={(checked) => setAssignFilter(prev => checked ? [...prev, u.id] : prev.filter(x => x !== u.id))}
                  >
                    {u.full_name || u.email}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Source Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Source
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {SOURCES.map(s => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={sourceFilter.includes(s)}
                    onCheckedChange={(checked) => setSourceFilter(prev => checked ? [...prev, s] : prev.filter(x => x !== s))}
                  >
                    {SOURCE_LABEL[s]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {STATUSES.map(s => (
                  <DropdownMenuCheckboxItem
                    key={s.value}
                    checked={statusFilter.includes(s.value)}
                    onCheckedChange={(checked) => setStatusFilter(prev => checked ? [...prev, s.value] : prev.filter(x => x !== s.value))}
                  >
                    {s.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* List */}
        {leadsLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasLeads={totalLeads > 0} onCreated={() => queryClient.invalidateQueries({ queryKey: ["leads"] })} />
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="hidden grid-cols-12 gap-6 border-b border-border bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 sm:grid">
                <div className="col-span-3">Contact</div>
                <div className="col-span-2">Phone</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1">Source</div>
                <div className="col-span-2">Assigned To</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              <ul className="divide-y divide-border">
                {filtered.map((lead) => (
                  <li
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="grid cursor-pointer grid-cols-1 gap-2 px-4 py-3 transition hover:bg-muted/40 sm:grid-cols-12 sm:items-center sm:gap-6"
                  >
                    <div className="col-span-3">
                      <div className="font-bold text-[#6E3FF3] truncate">{lead.name}</div>
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground truncate">
                      {lead.phone || "—"}
                    </div>
                    <div className="col-span-2">
                      <StatusBadge status={lead.status} />
                    </div>
                    <div className="col-span-1">
                      {lead.source && (
                        <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none text-[10px]">
                          {SOURCE_LABEL[lead.source] || lead.source}
                        </Badge>
                      )}
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground">
                      {lead.assigned_to ? (
                        userMap.get(lead.assigned_to)?.full_name || userMap.get(lead.assigned_to)?.email?.split("@")[0] || "Unknown"
                      ) : "—"}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-3 text-muted-foreground">
                      <button 
                        className="hover:text-foreground transition-colors"
                        onClick={(e) => { e.stopPropagation(); navigate(`/leads/${lead.id}`); }}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <LeadFormDialog 
                        lead={lead} 
                        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["leads"] })} 
                        trigger={
                          <button className="hover:text-foreground transition-colors" onClick={(e) => e.stopPropagation()}>
                            <Pencil className="h-4 w-4" />
                          </button>
                        }
                      />
                      {isSuperadmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="hover:text-destructive transition-colors" onClick={(e) => e.stopPropagation()}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the lead
                                and all associated data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => {
                                  deleteLeadMutation.mutate(lead.id);
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Pagination Controls */}
            <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalLeads)} of {totalLeads} leads
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Rows per page:</span>
                  <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt.toString()}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {totalPages > 1 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </main>
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
