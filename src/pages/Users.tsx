import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ShieldAlert, UserPlus, Pencil, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ManagedUser, AdminFunctionResponse } from "@/lib/leads";

type UserRole = "standard" | "superadmin";

export default function Users() {
  const { isSuperadmin, loading: rolesLoading } = useRoles();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("standard");
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  
  const generatePassword = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let retVal = "";
    for (let i = 0; i < 12; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setPassword(retVal);
  };
  const [editRole, setEditRole] = useState<UserRole>("standard");
  const [editPassword, setEditPassword] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    document.title = "Users — Carbon Car Care CRM";
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke<AdminFunctionResponse>("admin-create-user", {
      body: { action: "list" },
    });
    if (error) toast.error(error.message);
    else setUsers(data?.users ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperadmin) load();
  }, [isSuperadmin]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const { data, error } = await supabase.functions.invoke<AdminFunctionResponse>("admin-create-user", {
      body: { action: "create", email, password, role, full_name: newUserName },
    });
    setCreating(false);
    if (error || data?.error) {
      toast.error(error?.message ?? data?.error ?? "Failed to create user");
      return;
    }
    toast.success("User created");
    setOpen(false);
    setEmail("");
    setNewUserName("");
    setPassword("");
    setRole("standard");
    load();
  };

  const remove = async (id: string, userEmail: string) => {
    if (!confirm(`Delete ${userEmail}? They will lose access immediately.`)) return;
    const { data, error } = await supabase.functions.invoke<AdminFunctionResponse>("admin-create-user", {
      body: { action: "delete", user_id: id },
    });
    if (error || data?.error) {
      toast.error(error?.message ?? data?.error ?? "Failed");
      return;
    }
    toast.success("User deleted");
    load();
  };

  const update = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUpdating(true);
    const { data, error } = await supabase.functions.invoke<AdminFunctionResponse>("admin-create-user", {
      body: { 
        action: "update", 
        user_id: editingUser.id, 
        role: editRole,
        full_name: editingUser.full_name,
        password: editPassword || undefined
      },
    });
    setUpdating(false);
    if (error || data?.error) {
      toast.error(error?.message ?? data?.error ?? "Failed to update user");
      return;
    }
    toast.success("User updated");
    setEditingUser(null);
    setEditPassword("");
    load();
  };

  if (rolesLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperadmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-10 text-center shadow-soft">
          <ShieldAlert className="mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Superadmin access required</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only superadmins can manage user accounts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Provision and manage team members. Only superadmins can add users.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(val) => {
          setOpen(val);
          if (val) generatePassword();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add user
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Add new user
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">Full Name</Label>
                <Input
                  id="new-name"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pass">Temporary password</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-pass"
                    type="text"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="font-mono"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    onClick={generatePassword}
                    title="Generate new password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this securely with the user. They can change it later.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard user</SelectItem>
                    <SelectItem value="superadmin">Superadmin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create user
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No users yet.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    {u.roles.length === 0 ? (
                      <Badge variant="outline">no role</Badge>
                    ) : (
                      u.roles.map((r) => (
                        <Badge
                          key={r}
                          variant={r === "superadmin" ? "default" : "secondary"}
                          className="mr-1"
                        >
                          {r}
                        </Badge>
                      ))
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.created_at ? format(new Date(u.created_at), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.last_sign_in_at
                      ? format(new Date(u.last_sign_in_at), "MMM d, yyyy")
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingUser(u);
                          setEditRole((u.roles[0] as UserRole) || "standard");
                          setEditPassword("");
                        }}
                        aria-label="Edit user"
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(u.id, u.email)}
                        aria-label="Delete user"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>

    <Dialog open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Edit user: {editingUser?.email}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={update} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input
              id="edit-name"
              value={editingUser?.full_name || ""}
              onChange={(e) => setEditingUser(prev => prev ? { ...prev, full_name: e.target.value } : null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard user</SelectItem>
                <SelectItem value="superadmin">Superadmin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-pass">Reset password (optional)</Label>
            <Input
              id="edit-pass"
              type="text"
              minLength={6}
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="Leave blank to keep current"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updating}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      </Dialog>
    </>
  );
}
