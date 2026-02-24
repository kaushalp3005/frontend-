"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { useAuthStore } from "@/lib/stores/auth"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Pencil, Trash2, Users, RefreshCw, Shield, Building2 } from "lucide-react"
import { userApiService, type UserRecord, type CreateUserPayload, type UpdateUserPayload, type ModulePermissionData, type CompanyRoleData } from "@/lib/api/users"

interface SettingsPageProps {
  params: {
    company: string
  }
}

const ACTIONS = ["access", "view", "create", "edit", "delete", "approve"] as const
type ActionKey = typeof ACTIONS[number]

export default function SettingsPage({ params }: SettingsPageProps) {
  const company = params.company.toUpperCase()
  const { user: currentUser } = useAuthStore()
  const isAdminOrDev = currentUser?.isDeveloper || currentUser?.companies?.some(c => c.code === company && (c.role === "admin" || c.role === "developer"))

  // User list state
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Permissions dialog state
  const [permUser, setPermUser] = useState<UserRecord | null>(null)
  const [permModules, setPermModules] = useState<ModulePermissionData[]>([])
  const [permLoading, setPermLoading] = useState(false)
  const [permSaving, setPermSaving] = useState(false)

  // Company roles dialog state
  const [rolesUser, setRolesUser] = useState<UserRecord | null>(null)
  const [companyRoles, setCompanyRoles] = useState<CompanyRoleData[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [rolesSaving, setRolesSaving] = useState(false)

  // Form state
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formPassword, setFormPassword] = useState("")
  const [formIsDeveloper, setFormIsDeveloper] = useState(false)
  const [formIsActive, setFormIsActive] = useState(true)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await userApiService.getUsers()
      setUsers(data)
    } catch (err) {
      console.error("Failed to load users:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const resetForm = () => {
    setFormName("")
    setFormEmail("")
    setFormPassword("")
    setFormIsDeveloper(false)
    setFormIsActive(true)
  }

  const openCreateDialog = () => {
    setEditingUser(null)
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (user: UserRecord) => {
    setEditingUser(user)
    setFormName(user.name)
    setFormEmail(user.email)
    setFormPassword("")
    setFormIsDeveloper(user.is_developer)
    setFormIsActive(user.is_active)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      console.error("Validation: Name and email are required.")
      return
    }

    if (!editingUser && !formPassword.trim()) {
      console.error("Validation: Password is required for new users.")
      return
    }

    setSaving(true)

    try {
      if (editingUser) {
        const payload: UpdateUserPayload = {
          name: formName.trim(),
          email: formEmail.trim(),
          is_developer: formIsDeveloper,
          is_active: formIsActive,
        }
        if (formPassword.trim()) {
          payload.password = formPassword.trim()
        }
        await userApiService.updateUser(editingUser.id, payload)
        console.log("User updated successfully.")
      } else {
        const payload: CreateUserPayload = {
          name: formName.trim(),
          email: formEmail.trim(),
          password: formPassword.trim(),
          is_developer: formIsDeveloper,
          is_active: formIsActive,
        }
        await userApiService.createUser(payload)
        console.log("User created successfully.")
      }

      setDialogOpen(false)
      resetForm()
      fetchUsers()
    } catch (err) {
      console.error("Failed to save user:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)

    try {
      await userApiService.deleteUser(deleteTarget.email)
      console.log("User deleted successfully.")
      setDeleteTarget(null)
      fetchUsers()
    } catch (err) {
      console.error("Failed to delete user:", err)
    } finally {
      setDeleting(false)
    }
  }

  const openPermissionsDialog = async (user: UserRecord) => {
    setPermUser(user)
    setPermLoading(true)
    try {
      const data = await userApiService.getPermissions(company, user.id)
      setPermModules(data.modules)
    } catch (err) {
      console.error("Failed to load permissions:", err)
      setPermModules([])
    } finally {
      setPermLoading(false)
    }
  }

  const togglePermission = (moduleIdx: number, action: ActionKey) => {
    setPermModules((prev) =>
      prev.map((m, i) =>
        i === moduleIdx
          ? { ...m, permissions: { ...m.permissions, [action]: !m.permissions[action] } }
          : m
      )
    )
  }

  const handleSavePermissions = async () => {
    if (!permUser) return
    setPermSaving(true)
    try {
      await userApiService.updatePermissions(
        company,
        permUser.id,
        permModules.map((m) => ({ module_code: m.module_code, permissions: m.permissions }))
      )
      console.log("Permissions saved.")
      setPermUser(null)
    } catch (err) {
      console.error("Failed to save permissions:", err)
    } finally {
      setPermSaving(false)
    }
  }

  const openCompanyRolesDialog = async (user: UserRecord) => {
    setRolesUser(user)
    setRolesLoading(true)
    try {
      const data = await userApiService.getCompanyRoles(user.id)
      setCompanyRoles(data)
    } catch (err) {
      console.error("Failed to load company roles:", err)
      setCompanyRoles([])
    } finally {
      setRolesLoading(false)
    }
  }

  const setCompanyRole = (companyCode: string, role: string) => {
    setCompanyRoles((prev) =>
      prev.map((c) =>
        c.company_code === companyCode ? { ...c, role: role === "none" ? null : role } : c
      )
    )
  }

  const handleSaveCompanyRoles = async () => {
    if (!rolesUser) return
    setRolesSaving(true)
    try {
      const assigned = companyRoles
        .filter((c) => c.role)
        .map((c) => ({ company_code: c.company_code, role: c.role! }))
      await userApiService.updateCompanyRoles(rolesUser.id, assigned)
      console.log("Company roles saved.")
      setRolesUser(null)
    } catch (err) {
      console.error("Failed to save company roles:", err)
    } finally {
      setRolesSaving(false)
    }
  }

  return (
    <PermissionGuard module="settings" action="view">
      <div className="container mx-auto p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">User Management</h1>
            <Badge variant="outline" className="text-xs">
              {users.length} {users.length === 1 ? "user" : "users"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add User
            </Button>
          </div>
        </div>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading users...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No users found.</p>
                <Button size="sm" className="mt-4" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add your first user
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-center">Developer</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell className="text-center">
                          {user.is_developer ? (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800">
                              Developer
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {user.is_active ? (
                            <Badge className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isAdminOrDev && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                                  title="Company access"
                                  onClick={() => openCompanyRolesDialog(user)}
                                >
                                  <Building2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-blue-600 hover:text-blue-700"
                                  title="Module permissions"
                                  onClick={() => openPermissionsDialog(user)}
                                >
                                  <Shield className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(user)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(user)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

        {/* Create / Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) resetForm()
          setDialogOpen(open)
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
              <DialogDescription>
                {editingUser
                  ? "Update the user details below. Leave password blank to keep it unchanged."
                  : "Fill in the details to create a new user."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  Password {editingUser && <span className="text-xs text-muted-foreground">(leave blank to keep current)</span>}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={editingUser ? "••••••••" : "Enter password"}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="is_developer" className="text-sm font-medium">Developer</Label>
                  <p className="text-xs text-muted-foreground">Grant developer privileges</p>
                </div>
                <Switch
                  id="is_developer"
                  checked={formIsDeveloper}
                  onCheckedChange={setFormIsDeveloper}
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="is_active" className="text-sm font-medium">Active</Label>
                  <p className="text-xs text-muted-foreground">Allow user to log in</p>
                </div>
                <Switch
                  id="is_active"
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive}
                  disabled={saving}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingUser ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span> ({deleteTarget?.email})?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Permissions Dialog */}
        <Dialog open={!!permUser} onOpenChange={(open) => { if (!open) setPermUser(null) }}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Module Permissions
              </DialogTitle>
              <DialogDescription>
                Manage permissions for <span className="font-semibold">{permUser?.name}</span> ({permUser?.email}) in {company}
              </DialogDescription>
            </DialogHeader>

            {permLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading permissions...</span>
              </div>
            ) : permModules.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No modules found for this company.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Module</TableHead>
                      {ACTIONS.map((a) => (
                        <TableHead key={a} className="text-center text-xs capitalize w-[70px]">{a}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {permModules.map((mod, idx) => (
                      <TableRow key={mod.module_code}>
                        <TableCell className="font-medium text-sm">{mod.module_name}</TableCell>
                        {ACTIONS.map((action) => (
                          <TableCell key={action} className="text-center">
                            <Checkbox
                              checked={mod.permissions[action]}
                              onCheckedChange={() => togglePermission(idx, action)}
                              disabled={permSaving}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setPermUser(null)} disabled={permSaving}>
                Cancel
              </Button>
              <Button onClick={handleSavePermissions} disabled={permSaving || permLoading || permModules.length === 0}>
                {permSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Permissions
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Company Roles Dialog */}
        <Dialog open={!!rolesUser} onOpenChange={(open) => { if (!open) setRolesUser(null) }}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" />
                Company Access
              </DialogTitle>
              <DialogDescription>
                Assign <span className="font-semibold">{rolesUser?.name}</span> ({rolesUser?.email}) to companies and set their role.
              </DialogDescription>
            </DialogHeader>

            {rolesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading companies...</span>
              </div>
            ) : companyRoles.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No active companies found.
              </div>
            ) : (
              <div className="space-y-3">
                {companyRoles.map((comp) => (
                  <div
                    key={comp.company_code}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{comp.company_name}</p>
                      <p className="text-xs text-muted-foreground">{comp.company_code}</p>
                    </div>
                    <Select
                      value={comp.role || "none"}
                      onValueChange={(val) => setCompanyRole(comp.company_code, val)}
                      disabled={rolesSaving}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No access</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="ops">Ops</SelectItem>
                        <SelectItem value="approver">Approver</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setRolesUser(null)} disabled={rolesSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveCompanyRoles} disabled={rolesSaving || rolesLoading || companyRoles.length === 0}>
                {rolesSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Access
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  )
}
