"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  Code, 
  Users, 
  Building2, 
  Settings, 
  Plus, 
  Edit, 
  Trash2,
  Save,
  Shield,
  AlertCircle
} from "lucide-react"
import { useAuthStore, type Company, type Module, type Action, type Role } from "@/lib/stores/auth"
import { PermissionGuard } from "@/components/auth/permission-gate"

interface User {
  id: string
  email: string
  name: string
  isActive: boolean
  isDeveloper: boolean
  companies: Array<{
    code: Company
    role: Role
    permissions: Record<Module, Record<Action, boolean>>
  }>
}

interface CompanyInfo {
  code: Company
  name: string
  isActive: boolean
}

const mockUsers: User[] = [
  {
    id: "1",
    email: "admin@company.com",
    name: "Admin User",
    isActive: true,
    isDeveloper: false,
    companies: [
      {
        code: "CDPL",
        role: "admin",
        permissions: {
          dashboard: { access: true, view: true, create: true, edit: true, delete: true, approve: true },
          inward: { access: true, view: true, create: true, edit: true, delete: true, approve: true },
          "inventory-ledger": { access: true, view: true, create: false, edit: false, delete: false, approve: false },
          transfer: { access: true, view: true, create: true, edit: true, delete: true, approve: true },
          outward: { access: false, view: false, create: false, edit: false, delete: false, approve: false },
          reports: { access: true, view: true, create: false, edit: false, delete: false, approve: false },
          settings: { access: true, view: true, create: true, edit: true, delete: true, approve: true },
          developer: { access: false, view: false, create: false, edit: false, delete: false, approve: false }
        }
      }
    ]
  }
]

const mockCompanies: CompanyInfo[] = [
  { code: "CDPL", name: "CDPL Company Limited", isActive: true },
  { code: "CFPL", name: "CFPL Operations", isActive: true },
  { code: "JTC", name: "JTC Industries", isActive: true },
  { code: "HOH", name: "HOH Enterprises", isActive: true }
]

const modules: Array<{ code: Module; name: string }> = [
  { code: "dashboard", name: "Dashboard" },
  { code: "inward", name: "Inward Management" },
  { code: "inventory-ledger", name: "Inventory Ledger" },
  { code: "transfer", name: "Transfer Management" },
  { code: "outward", name: "Outward Management" },
  { code: "reports", name: "Reports & Analytics" },
  { code: "settings", name: "Settings" },
  { code: "developer", name: "Developer Console" }
]

const actions: Array<{ code: Action; name: string }> = [
  { code: "access", name: "Access Module" },
  { code: "view", name: "View Records" },
  { code: "create", name: "Create Records" },
  { code: "edit", name: "Edit Records" },
  { code: "delete", name: "Delete Records" },
  { code: "approve", name: "Approve Records" }
]

const roles: Array<{ code: Role; name: string }> = [
  { code: "admin", name: "Administrator" },
  { code: "manager", name: "Manager" },
  { code: "operator", name: "Operator" },
  { code: "viewer", name: "Viewer" },
  { code: "developer", name: "Developer" }
]

export default function DeveloperPage() {
  const { isDeveloperUser, currentCompany } = useAuthStore()
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [companies] = useState<CompanyInfo[]>(mockCompanies)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false)

  if (!isDeveloperUser()) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Access denied. Developer privileges required.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const handleEditUser = (user: User) => {
    setSelectedUser({ ...user })
    setIsEditDialogOpen(true)
  }

  const handleSaveUser = () => {
    if (selectedUser) {
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? selectedUser : u))
      setIsEditDialogOpen(false)
      setSelectedUser(null)
    }
  }

  const handlePermissionChange = (
    companyCode: Company, 
    moduleCode: Module, 
    actionCode: Action, 
    value: boolean
  ) => {
    if (!selectedUser) return

    setSelectedUser(prev => ({
      ...prev!,
      companies: prev!.companies.map(comp => 
        comp.code === companyCode 
          ? {
              ...comp,
              permissions: {
                ...comp.permissions,
                [moduleCode]: {
                  ...comp.permissions[moduleCode],
                  [actionCode]: value
                }
              }
            }
          : comp
      )
    }))
  }

  return (
    <PermissionGuard module="developer" action="access">
      <div className="container mx-auto p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3">
              <Code className="h-6 w-6 sm:h-8 sm:w-8" />
              Developer Console
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage user access and system permissions</p>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-2 sm:space-y-4">
          <TabsList>
            <TabsTrigger value="users" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="companies" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Building2 className="h-3 w-3 sm:h-4 sm:w-4" />
              Companies
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
              System Settings
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base sm:text-lg">User Management</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Manage user access and permissions</CardDescription>
                  </div>
                  <Dialog open={isNewUserDialogOpen} onOpenChange={setIsNewUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="text-xs">
                        <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>Create a new user account</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 sm:space-y-4">
                        <div>
                          <Label htmlFor="name" className="text-xs sm:text-sm">Full Name</Label>
                          <Input id="name" placeholder="Enter full name" className="h-8 text-xs sm:text-sm" />
                        </div>
                        <div>
                          <Label htmlFor="email" className="text-xs sm:text-sm">Email Address</Label>
                          <Input id="email" type="email" placeholder="user@company.com" className="h-8 text-xs sm:text-sm" />
                        </div>
                        <div>
                          <Label htmlFor="role" className="text-xs sm:text-sm">Default Role</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map(role => (
                                <SelectItem key={role.code} value={role.code} className="text-xs">
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNewUserDialogOpen(false)} size="sm" className="text-xs">
                          Cancel
                        </Button>
                        <Button onClick={() => setIsNewUserDialogOpen(false)} size="sm" className="text-xs">
                          Create User
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">User</TableHead>
                        <TableHead className="text-xs sm:text-sm">Companies</TableHead>
                        <TableHead className="text-xs sm:text-sm">Status</TableHead>
                        <TableHead className="text-xs sm:text-sm">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-xs sm:text-sm">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                            {user.isDeveloper && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                <Code className="mr-1 h-2 w-2 sm:h-3 sm:w-3" />
                                Developer
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-1 sm:px-4">
                          <div className="flex flex-wrap gap-1">
                            {user.companies.map((company) => (
                              <Badge key={company.code} variant="outline" className="text-xs">
                                {company.code} ({company.role})
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? "default" : "secondary"} className="text-xs">
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                            className="h-7 w-7 sm:h-8 sm:w-8"
                          >
                            <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Companies Tab */}
          <TabsContent value="companies">
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Company Management</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Manage company settings and configurations</CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Code</TableHead>
                        <TableHead className="text-xs sm:text-sm">Name</TableHead>
                        <TableHead className="text-xs sm:text-sm">Status</TableHead>
                        <TableHead className="text-xs sm:text-sm">Users</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {companies.map((company) => {
                      const userCount = users.filter(u => 
                        u.companies.some(c => c.code === company.code)
                      ).length
                      
                      return (
                        <TableRow key={company.code}>
                          <TableCell>
                            <Badge variant="outline">{company.code}</Badge>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">{company.name}</TableCell>
                          <TableCell>
                            <Badge variant={company.isActive ? "default" : "secondary"} className="text-xs">
                              {company.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">{userCount} users</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Settings Tab */}
          <TabsContent value="system">
            <div className="grid gap-3 sm:gap-4">
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">OpenFGA Configuration</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Configure OpenFGA authorization settings</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0 space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label className="text-xs sm:text-sm">Store ID</Label>
                      <Input value="default-store" readOnly className="h-8 text-xs sm:text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs sm:text-sm">API URL</Label>
                      <Input value="http://localhost:8080" readOnly className="h-8 text-xs sm:text-sm" />
                    </div>
                  </div>
                  <Alert>
                    <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                    <AlertDescription className="text-xs sm:text-sm">
                      OpenFGA configuration is managed through environment variables.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Module Configuration</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Configure available modules and their settings</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {modules.map((module) => (
                      <div key={module.code} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg gap-2">
                        <div>
                          <p className="font-medium text-sm">{module.name}</p>
                          <p className="text-xs text-muted-foreground">{module.code}</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit User Permissions</DialogTitle>
              <DialogDescription>
                {selectedUser?.name} ({selectedUser?.email})
              </DialogDescription>
            </DialogHeader>
            
            {selectedUser && (
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={selectedUser.isActive}
                      onCheckedChange={(checked) =>
                        setSelectedUser(prev => ({ ...prev!, isActive: checked }))
                      }
                    />
                    <Label>Active User</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={selectedUser.isDeveloper}
                      onCheckedChange={(checked) =>
                        setSelectedUser(prev => ({ ...prev!, isDeveloper: checked }))
                      }
                    />
                    <Label>Developer Access</Label>
                  </div>
                </div>

                {selectedUser.companies.map((company) => (
                  <Card key={company.code}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{companies?.find(c => c.code === company.code)?.name || company.code}</span>
                        <div className="flex items-center space-x-2">
                          <Label>Role:</Label>
                          <Select
                            value={company.role}
                            onValueChange={(value: Role) =>
                              setSelectedUser(prev => ({
                                ...prev!,
                                companies: prev!.companies.map(c =>
                                  c.code === company.code ? { ...c, role: value } : c
                                )
                              }))
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map(role => (
                                <SelectItem key={role.code} value={role.code}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Module</TableHead>
                            {actions.map(action => (
                              <TableHead key={action.code}>{action.name}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {modules.map((module) => (
                            <TableRow key={module.code}>
                              <TableCell className="font-medium">{module.name}</TableCell>
                              {actions.map(action => (
                                <TableCell key={action.code}>
                                  <Switch
                                    checked={company.permissions[module.code]?.[action.code] || false}
                                    onCheckedChange={(checked) =>
                                      handlePermissionChange(company.code, module.code, action.code, checked)
                                    }
                                  />
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveUser}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  )
}
