import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ManagedUser } from "@/lib/leads";
import { format } from "date-fns";
import { 
  Loader2, 
  Activity, 
  ArrowRight, 
  Calendar, 
  MessageSquare, 
  User,
  FileText,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AuditLogEntry = {
  id: string;
  created_at: string;
  user_id: string | null;
  action_type: string;
  table_name: string;
  record_id: string | null;
  old_data: any;
  new_data: any;
};

export default function AuditLogs() {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    document.title = "Activity Audit Logs — Carbon Car Care";
  }, []);

  // Fetch directory to match UUIDs to emails
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { action: "list" },
      });
      if (error) throw error;
      return (data?.users || []) as ManagedUser[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const userMap = useMemo(() => {
    const map = new Map<string, ManagedUser>();
    users.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);

  // Fetch audit logs with exact count and pagination
  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error, count } = await supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      
      if (error) throw error;
      return {
        logs: (data || []) as AuditLogEntry[],
        total: count || 0
      };
    },
    refetchInterval: 30000,
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Security safe bounds checking
  useEffect(() => {
    if (page > totalPages && !isLoading && totalPages > 0) {
      setPage(totalPages);
    }
  }, [totalPages, page, isLoading]);

  const getActionBadge = (type: string) => {
    switch(type.toUpperCase()) {
      case 'INSERT': return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20 shadow-none">Created</Badge>;
      case 'UPDATE': return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/20 shadow-none">Modified</Badge>;
      case 'DELETE': return <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-none">Deleted</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getTableIcon = (tableName: string) => {
    switch(tableName) {
      case 'leads': return <User className="h-4 w-4 text-blue-500" />;
      case 'lead_notes': return <MessageSquare className="h-4 w-4 text-violet-500" />;
      default: return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getReadableSummary = (log: AuditLogEntry) => {
    const d = log.new_data || log.old_data || {};
    if (log.table_name === 'leads') {
      const name = d.name || 'Lead';
      return (
        <span className="font-medium">
          Lead: <span className="text-foreground">{name}</span>
        </span>
      );
    }
    if (log.table_name === 'lead_notes') {
      const preview = (d.content || '').substring(0, 40);
      return (
        <span className="italic text-muted-foreground">
          Note: "{preview}{preview.length >= 40 ? '...' : ''}"
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground font-mono">{log.record_id?.substring(0,8)}</span>;
  };

  const getDestinationLink = (log: AuditLogEntry) => {
    const d = log.new_data || log.old_data || {};
    if (log.action_type === 'DELETE') return null;
    if (log.table_name === 'leads') return `/leads/${log.record_id}`;
    if (log.table_name === 'lead_notes' && d.lead_id) return `/leads/${d.lead_id}`;
    return null;
  };

  return (
    <div className="min-h-screen bg-background/50 p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight brand-gradient-text inline-block">System Audit Trail</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Monitor operations performed by team members. Transparent record of creation, updates, and removals across the system.
          </p>
        </div>

        <div className="premium-card flex flex-col overflow-hidden min-h-[400px]">
          {isLoading && !data ? (
            <div className="flex-1 flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
              <p className="text-sm text-muted-foreground font-medium">Compiling audit journal...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Activity className="h-6 w-6 text-muted-foreground opacity-40" />
              </div>
              <p className="text-lg font-semibold">No audit history found yet.</p>
              <p className="text-sm">Activities will appear here as they are performed by users.</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/30 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4">Timestamp</th>
                      <th className="px-6 py-4">Operator</th>
                      <th className="px-6 py-4">Action</th>
                      <th className="px-6 py-4">Entity</th>
                      <th className="px-6 py-4">Target Info</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 relative">
                    {/* Overlay loader for page switches */}
                    {isLoading && (
                      <div className="absolute inset-0 bg-background/40 flex items-center justify-center backdrop-blur-[1px] z-10" />
                    )}
                    {logs.map((log) => {
                      const operator = log.user_id ? userMap.get(log.user_id) : null;
                      const link = getDestinationLink(log);
                      
                      return (
                        <tr key={log.id} className="group hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 opacity-50" />
                              {format(new Date(log.created_at), "MMM dd, HH:mm:ss")}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">{operator?.full_name || "Unknown User"}</span>
                              <span className="text-xs text-muted-foreground">{operator?.email || (log.user_id ? log.user_id.substring(0,8) : "")}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {getActionBadge(log.action_type)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 bg-muted/50 rounded-md border border-border/40">
                                {getTableIcon(log.table_name)}
                              </span>
                              <span className="font-medium capitalize">{log.table_name.replace('_', ' ').replace('s', '')}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {getReadableSummary(log)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {link ? (
                              <Link 
                                to={link} 
                                className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-transparent font-medium text-primary hover:border-primary/20 hover:bg-primary/5 transition-all text-xs gap-1"
                              >
                                View Detail
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground italic px-3">Immutable</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border bg-muted/10 px-6 py-4 gap-4">
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground order-2 sm:order-1">
                  <span>Rows per page</span>
                  <Select 
                    value={String(pageSize)} 
                    onValueChange={(val) => {
                      setPageSize(Number(val));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px] bg-background shadow-none border-border ring-offset-background focus:ring-1 focus:ring-ring">
                      <SelectValue placeholder={pageSize} />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 10, 20, 50].map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-6 order-1 sm:order-2 w-full sm:w-auto justify-between sm:justify-end">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    Showing <span className="font-medium text-foreground">{Math.min((page - 1) * pageSize + 1, total)}</span> to <span className="font-medium text-foreground">{Math.min(page * pageSize, total)}</span> of <span className="font-medium text-foreground">{total}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shadow-none border-border"
                      disabled={page === 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center px-3 h-8 border border-transparent text-sm font-medium text-foreground bg-muted/30 rounded-md min-w-[3rem] justify-center">
                      {page} / {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shadow-none border-border"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
