'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Shield, Plus, Building2, UserCircle, MoreHorizontal, Edit, UserX, UserCheck } from 'lucide-react'

type Profile = {
  id: string
  email: string
  full_name: string
  role: string
  warehouse_id: string | null
  is_active: boolean
  warehouses?: { name: string } 
}

type Warehouse = {
  id: string
  name: string
  warehouse_type: string
}

const defaultForm = {
  id: '',
  email: '',
  password: '',
  full_name: '',
  role: 'sales_person',
  warehouse_id: 'none',
  is_active: true
}

export default function UsersManagementPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<Profile[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)

  const [formData, setFormData] = useState(defaultForm)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*, warehouses(name)')
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError
      setUsers(profilesData || [])

      const { data: warehousesData, error: warehousesError } = await supabase
        .from('warehouses')
        .select('id, name, warehouse_type, is_active')
        .order('name')
    
      if (warehousesError) throw warehousesError
      const activeLocations = warehousesData?.filter(w => w.is_active) || []
      setWarehouses(activeLocations)
      
    } catch (error: any) {
      toast({ title: 'Error fetching data', description: error.message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const openCreateModal = () => {
    setFormData(defaultForm)
    setIsEditMode(false)
    setIsDialogOpen(true)
  }

  const openEditModal = (user: Profile) => {
    setFormData({
      id: user.id,
      email: user.email,
      password: '', // Leave blank to not change password
      full_name: user.full_name,
      role: user.role,
      warehouse_id: user.warehouse_id || 'none',
      is_active: user.is_active !== false // Default to true if null
    })
    setIsEditMode(true)
    setIsDialogOpen(true)
  }

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId)

      if (error) throw error
      
      toast({ title: 'Status Updated', description: `User is now ${!currentStatus ? 'Active' : 'Inactive'}` })
      fetchData()
    } catch (error: any) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // If editing, we hit a PUT route (or handle via Supabase client for profile data)
      const method = isEditMode ? 'PUT' : 'POST'
      
      const response = await fetch('/api/users', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          warehouse_id: formData.warehouse_id === 'none' ? null : formData.warehouse_id
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to process request')

      toast({ 
        title: 'Success', 
        description: `User successfully ${isEditMode ? 'updated' : 'created'}!` 
      })
      setIsDialogOpen(false)
      fetchData() 
    } catch (error: any) {
      toast({ title: 'Action Failed', description: error.message, variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">User Access & Roles</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Manage system access for main office and branch staff.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button onClick={openCreateModal} className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Add New User
          </Button>

          <DialogContent className="sm:max-w-md w-[95vw] rounded-xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Edit System User' : 'Create System User'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input required value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} placeholder="John Doe" />
              </div>
              
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" disabled={isEditMode} required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="john@branch.com" />
              </div>

              <div className="space-y-2">
                <Label>{isEditMode ? 'New Password (Leave blank to keep current)' : 'Temporary Password'}</Label>
                <Input type="password" required={!isEditMode} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="••••••••" minLength={6} />
              </div>

              <div className="space-y-2">
                <Label>Role / Access Level</Label>
                <Select value={formData.role} onValueChange={(val) => setFormData({...formData, role: val})}>
                  <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner (Full Access)</SelectItem>
                    <SelectItem value="manager">Manager (Full Access)</SelectItem>
                    <SelectItem value="operations_manager">Operations Manager (Inv/Mfg)</SelectItem>
                    <SelectItem value="voucher_manager">Voucher Manager</SelectItem>
                    <SelectItem value="branch_manager">Branch Manager</SelectItem>
                    <SelectItem value="sales_person">Sales Person (POS/CRM)</SelectItem>
                    <SelectItem value="crm_manager">CRM Manager (CRM/Track Voucher)</SelectItem>

                    {/* NEW SHADOW ROLES */}
                    <SelectItem value="shadow_manager">Shadow Manager (Read-Only)</SelectItem>
                    <SelectItem value="shadow_sales">Shadow Sales (Read-Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assign Warehouse / Branch</Label>
                <Select value={formData.warehouse_id} onValueChange={(val) => setFormData({...formData, warehouse_id: val})}>
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="font-semibold text-primary">Main Office (No Branch Restriction)</SelectItem>
                    {warehouses.map(w => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} <span className="text-muted-foreground capitalize text-xs ml-1">({w.warehouse_type?.replace('_', ' ')})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isEditMode && (
                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <Label>Active Account</Label>
                    <p className="text-xs text-muted-foreground">Allow user to log into the ERP</p>
                  </div>
                  <Switch 
                    checked={formData.is_active} 
                    onCheckedChange={(val) => setFormData({...formData, is_active: val})} 
                  />
                </div>
              )}

              <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : isEditMode ? 'Save Changes' : 'Create User'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-sm border-muted">
        <CardHeader className="pb-4">
          <CardTitle>Directory</CardTitle>
          <CardDescription>View and manage all registered accounts.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className={user.is_active === false ? "opacity-60 bg-muted/20" : ""}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium flex items-center gap-2">
                            <UserCircle className="h-4 w-4 text-muted-foreground" />
                            {user.full_name}
                          </span>
                          <span className="text-xs text-muted-foreground ml-6">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize font-normal bg-background">
                          <Shield className="h-3 w-3 text-primary mr-1" />
                          {user.role.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {user.warehouses?.name || 'Main Office'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active !== false ? "default" : "destructive"} className="text-[10px] uppercase">
                          {user.is_active !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openEditModal(user)} className="cursor-pointer">
                              <Edit className="mr-2 h-4 w-4" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleToggleStatus(user.id, user.is_active !== false)}
                              className={`cursor-pointer ${user.is_active !== false ? 'text-red-600' : 'text-green-600'}`}
                            >
                              {user.is_active !== false ? (
                                <><UserX className="mr-2 h-4 w-4" /> Suspend Access</>
                              ) : (
                                <><UserCheck className="mr-2 h-4 w-4" /> Restore Access</>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}