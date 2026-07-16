'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, ShieldCheck, Stethoscope, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { createUser, deleteUser, getUsers, updateUser } from '@/lib/auth';
import { Role, UserAccount } from '@/lib/types';
import { ROLE_META } from '@/lib/constants';
import { formatDateTime } from '@/lib/utils';
import { useAppState } from '@/components/app-provider';
import { useLocale } from '@/hooks/use-locale';

interface UserFormState {
  username: string;
  displayName: string;
  password: string;
  role: Role;
  active: boolean;
}

const emptyForm: UserFormState = {
  username: '',
  displayName: '',
  password: '',
  role: 'doctor',
  active: true,
};

export function UserManagement() {
  const { t } = useLocale();
  const { currentUser } = useAppState();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getUsers().then(setUsers).catch(console.error);
  }, []);

  const refresh = () => getUsers().then(setUsers).catch(console.error);

  const openNewUser = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setShowPassword(false);
    setDialogOpen(true);
  };

  const openEditUser = (user: UserAccount) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      displayName: user.displayName,
      password: '',
      role: user.role,
      active: user.active,
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.displayName.trim()) {
      toast.error('Username and display name are required.');
      return;
    }

    if (!editingUser && !form.password.trim()) {
      toast.error('Password is required for new users.');
      return;
    }

    if (form.password && form.password.length < 4) {
      toast.error('Password must be at least 4 characters.');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          displayName: form.displayName,
          role: form.role,
          active: form.active,
          password: form.password || undefined,
        });
        toast.success(`User "${form.displayName}" updated.`);
      } else {
        await createUser(form.username.trim(), form.password, form.displayName.trim(), form.role);
        toast.success(`User "${form.displayName}" created.`);
      }
      refresh();
      setDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save user.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.id === currentUser?.id) {
      toast.error('You cannot delete your own account.');
      setDeleteTarget(null);
      return;
    }
    await deleteUser(deleteTarget.id);
    refresh();
    setDeleteTarget(null);
    toast.success('User deleted.');
  };

  const handleToggleActive = async (user: UserAccount) => {
    if (user.id === currentUser?.id) {
      toast.error('You cannot deactivate your own account.');
      return;
    }
    await updateUser(user.id, { active: !user.active });
    refresh();
    toast.success(`User ${user.active ? 'deactivated' : 'activated'}.`);
  };

  const getRoleBadgeVariant = (role: Role) => {
    switch (role) {
      case 'admin': return 'destructive' as const;
      case 'doctor': return 'info' as const;
      case 'secretary': return 'warning' as const;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{t.users.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{t.users.description}</p>
              </div>
            </div>
            <Button onClick={openNewUser}>
              <UserPlus className="h-4 w-4" /> {t.users.addUser}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title={t.users.noUsers}
              description={t.users.noUsersDesc}
              action={
                <Button onClick={openNewUser}>
                  <Plus className="h-4 w-4" /> {t.users.createFirst}
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.users.user}</TableHead>
                    <TableHead>{t.users.username}</TableHead>
                    <TableHead>{t.users.role}</TableHead>
                    <TableHead>{t.common.status}</TableHead>
                    <TableHead>{t.users.lastLogin}</TableHead>
                    <TableHead>{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                            {user.role === 'admin' ? <ShieldCheck className="h-4 w-4" /> :
                             user.role === 'doctor' ? <Stethoscope className="h-4 w-4" /> :
                             <Users className="h-4 w-4" />}
                          </div>
                          <span className="font-medium">{user.displayName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{user.username}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {ROLE_META[user.role].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={user.active}
                          onCheckedChange={() => handleToggleActive(user)}
                          disabled={user.id === currentUser?.id}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : t.common.never}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditUser(user)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(user)}
                            disabled={user.id === currentUser?.id}
                          >
                            <Trash2 className="h-4 w-4 text-rose-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUser ? t.users.editUser : t.users.createUser}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.users.username}</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                placeholder={t.users.usernamePlaceholder}
                disabled={!!editingUser}
              />
              {editingUser && (
                <p className="text-xs text-muted-foreground">{t.users.usernameNoChange}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t.users.displayName}</Label>
              <Input
                value={form.displayName}
                onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
                placeholder={t.users.displayNamePlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label>{editingUser ? t.users.newPassword : 'Password'}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder={editingUser ? '••••••••' : t.users.passwordMin}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t.users.role}</Label>
              <Select value={form.role} onValueChange={(value) => setForm((prev) => ({ ...prev, role: value as Role }))}>
                <SelectItem value="admin">{t.users.roleAdmin}</SelectItem>
                <SelectItem value="doctor">{t.users.roleDoctor}</SelectItem>
                <SelectItem value="secretary">{t.users.roleSecretary}</SelectItem>
              </Select>
            </div>
            {editingUser && (
              <div className="flex items-center justify-between rounded-xl bg-muted p-3">
                <div>
                  <Label>{t.users.accountActive}</Label>
                  <p className="text-xs text-muted-foreground">{t.users.accountActiveDesc}</p>
                </div>
                <Switch
                  checked={form.active}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, active: checked }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t.users.saving : editingUser ? t.users.updateUser : t.users.createUser}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.users.deleteUser}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.users.deleteUserDesc} <strong>{deleteTarget?.displayName}</strong> ({deleteTarget?.username}) {t.users.deleteUserSuffix}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={handleDelete}>{t.common.delete}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
