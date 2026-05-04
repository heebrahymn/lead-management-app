import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SOURCES, SOURCE_LABEL, ManagedUser, SERVICES, STATUSES, Lead, LeadStatus, LeadSource, AdminFunctionResponse } from "@/lib/leads";
import { useEffect } from "react";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  source: z.string().trim().optional(),
  deal_value: z.coerce.number().min(0).optional(),
  company: z.string().trim().optional(),
  city: z.string().trim().optional(),
  service: z.string().trim().optional(),
  reg_number: z.string().trim().optional(),
  vehicle_model: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

interface Props {
  lead?: Lead;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function LeadFormDialog({ lead, onSuccess, trigger }: Props) {
  const isEdit = !!lead;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState({ 
    name: "", 
    email: "", 
    phone: "", 
    source: "call",
    status: "new",
    assigned_to: "",
    followup_at: "",
    deal_value: "",
    company: "",
    city: "",
    service: "",
    reg_number: "",
    vehicle_model: "",
    notes: ""
  });

  const reset = () => setForm({ 
    name: "", 
    email: "", 
    phone: "", 
    source: "call",
    status: "new",
    assigned_to: "",
    followup_at: "",
    deal_value: "",
    company: "",
    city: "",
    service: "",
    reg_number: "",
    vehicle_model: "",
    notes: ""
  });

  useEffect(() => {
    if (open) {
      supabase.functions.invoke<AdminFunctionResponse>("admin-create-user", {
        body: { action: "list" },
      }).then(({ data }) => {
        if (data?.users) setUsers(data.users);
      });

      if (isEdit && lead) {
        setForm({
          name: lead.name || "",
          email: lead.email || "",
          phone: lead.phone || "",
          source: lead.source || "call",
          status: lead.status || "new",
          assigned_to: lead.assigned_to || "none",
          followup_at: lead.followup_at ? lead.followup_at.split("T")[0] : "",
          deal_value: lead.deal_value?.toString() || "",
          company: lead.company || "",
          city: lead.city || "",
          service: lead.service || "",
          reg_number: lead.reg_number || "",
          vehicle_model: lead.vehicle_model || "",
          notes: lead.notes || ""
        });
      } else {
        reset();
      }
    }
  }, [open, isEdit, lead]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      source: (form.source.trim() || "call") as LeadSource,
      status: (form.status || "new") as LeadStatus,
      assigned_to: form.assigned_to && form.assigned_to !== "none" ? form.assigned_to : null,
      followup_at: form.followup_at ? new Date(form.followup_at).toISOString() : null,
      deal_value: form.deal_value ? Number(form.deal_value) : null,
      company: form.company.trim() || null,
      city: form.city.trim() || null,
      service: form.service.trim() || null,
      reg_number: form.reg_number.trim() || null,
      vehicle_model: form.vehicle_model.trim() || null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = isEdit 
      ? await supabase.from("leads").update(payload).eq("id", lead.id)
      : await supabase.from("leads").insert({ ...payload, created_by: userData.user?.id ?? null });

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isEdit ? "Lead updated" : "Lead added");
    setOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {isEdit ? "Edit Lead" : "Add Lead"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{isEdit ? "Edit Lead" : "Add New Lead"}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {isEdit ? "Update lead information and vehicle details." : "Fill in the details to log a new business lead."}
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Smith"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company</Label>
              <Input
                id="company"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Acme Corp"
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@acme.com"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+44 7700 000000"
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">City</Label>
              <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v })}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lagos">Lagos</SelectItem>
                  <SelectItem value="abuja">Abuja</SelectItem>
                  <SelectItem value="port-harcourt">Port Harcourt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lead Source</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SOURCE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assigned To</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email.split("@")[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="deal_value" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversion Value (£)</Label>
              <Input
                id="deal_value"
                type="number"
                step="0.01"
                value={form.deal_value}
                onChange={(e) => setForm({ ...form, deal_value: e.target.value })}
                placeholder="0.00"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="followup" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Follow-up Date</Label>
              <Input
                id="followup"
                type="date"
                value={form.followup_at}
                onChange={(e) => setForm({ ...form, followup_at: e.target.value })}
                className="h-10"
              />
            </div>
          </div>

          <div className="border-t border-border pt-4 mt-2">
            <h3 className="text-sm font-bold text-foreground mb-4">Vehicle Details</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Services</Label>
                <Select value={form.service} onValueChange={(v) => setForm({ ...form, service: v })}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg_number" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reg. Number</Label>
                <Input
                  id="reg_number"
                  value={form.reg_number}
                  onChange={(e) => setForm({ ...form, reg_number: e.target.value })}
                  placeholder="ABC-123"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vehicle_model" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vehicle Model</Label>
                <Input
                  id="vehicle_model"
                  value={form.vehicle_model}
                  onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })}
                  placeholder="Toyota Corolla 2022"
                  className="h-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</Label>
            <textarea
              id="notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any additional notes about this lead..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#6E3FF3] hover:bg-[#5B34CC]">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
