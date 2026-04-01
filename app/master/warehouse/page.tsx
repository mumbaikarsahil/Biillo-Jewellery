'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea' // <--- ADDED TEXTAREA FOR ADDRESS
import { Card, CardContent } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Warehouse, Search } from 'lucide-react'

// 1. UPDATE ZOD SCHEMA TO INCLUDE NEW FIELDS
const warehouseSchema = z.object({
  warehouse_code: z.string().min(2, 'Code required'),
  name: z.string().min(2, 'Name required'),
  warehouse_type: z.enum(['main_safe', 'factory', 'branch', 'transit']),
  address: z.string().optional(),
  contact_number: z.string().optional(),
  gstin: z.string().optional(),
})

export default function WarehousePage() {
  const { appUser } = useAuth()
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  // 2. SET DEFAULT VALUES FOR NEW FIELDS
  const form = useForm<z.infer<typeof warehouseSchema>>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      warehouse_code: '',
      name: '',
      warehouse_type: 'branch',
      address: '',
      contact_number: '',
      gstin: '',
    },
  })

  async function fetchWarehouses() {
    if (!appUser) return
    setLoading(true)

    const { data } = await supabase
      .from('warehouses')
      .select('*')
      .eq('company_id', appUser.company_id)
      .order('created_at', { ascending: false })

    setWarehouses(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchWarehouses()
  }, [appUser])

  async function onSubmit(values: z.infer<typeof warehouseSchema>) {
    if (!appUser) return

    try {
      // 3. PASS NEW FIELDS TO RPC OR DIRECT INSERT
      // Note: Ensure your 'create_warehouse' RPC is updated in Supabase to accept these new args!
      const { error } = await supabase.rpc('create_warehouse', {
        _user_id: appUser.user_id,
        _warehouse_code: values.warehouse_code,
        _name: values.name,
        _warehouse_type: values.warehouse_type,
        _address: values.address,            // <--- NEW
        _contact_number: values.contact_number, // <--- NEW
        _gstin: values.gstin                 // <--- NEW
      })

      if (error) throw error

      toast.success('Warehouse Created')
      setIsSheetOpen(false)
      form.reset()
      fetchWarehouses()
    } catch (err: any) {
      if (err.message?.includes('idx_warehouse_company_code')) {
        toast.error('Warehouse Code already exists')
      } else {
        toast.error(err.message)
      }
    }
  }

  const filtered = warehouses.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.warehouse_code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Warehouses</h1>
          <p className="text-sm text-muted-foreground">
            Manage inventory locations.
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-full sm:w-[450px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Create Warehouse / Branch</SheetTitle>
              </SheetHeader>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4 mt-6"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="warehouse_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Warehouse Code *</FormLabel>
                          <FormControl>
                            <Input {...field} className="uppercase" placeholder="e.g. BR-01" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="warehouse_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="main_safe">Main Safe</SelectItem>
                              <SelectItem value="factory">Factory</SelectItem>
                              <SelectItem value="branch">Branch</SelectItem>
                              <SelectItem value="transit">Transit</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warehouse Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. Andheri Main Branch" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 4. NEW UI FIELDS FOR ADDRESS, CONTACT, AND GSTIN */}
                  <FormField
                    control={form.control}
                    name="contact_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Number (For Invoices)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. +91 9876543210" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gstin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Branch GSTIN</FormLabel>
                        <FormControl>
                          <Input {...field} className="uppercase" placeholder="e.g. 27AAOPM1004A1ZB" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Address (Printed on Invoices)</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Viral Apartment, S.V. Road, Andheri West, Mumbai - 400058" 
                            className="resize-none h-24" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full mt-4">
                    Create Warehouse
                  </Button>
                </form>
              </Form>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block border rounded bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-semibold text-slate-700">Code</TableHead>
              <TableHead className="font-semibold text-slate-700">Name</TableHead>
              <TableHead className="font-semibold text-slate-700">Type</TableHead>
              <TableHead className="font-semibold text-slate-700">Contact</TableHead>
              <TableHead className="font-semibold text-slate-700">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">Loading warehouses...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">No warehouses found</TableCell>
              </TableRow>
            ) : (
              filtered.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-mono font-medium text-slate-600">
                    {w.warehouse_code}
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold text-slate-800">{w.name}</p>
                    {w.address && <p className="text-xs text-slate-500 truncate max-w-xs">{w.address}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="uppercase text-[10px] tracking-wider">{w.warehouse_type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {w.contact_number || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        w.is_active
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-100'
                      }
                    >
                      {w.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {filtered.map((w) => (
          <Card key={w.id}>
            <CardContent className="p-4">
              <div className="flex justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">{w.name}</h3>
                  <p className="text-sm font-mono text-slate-500">
                    {w.warehouse_code}
                  </p>
                </div>
                <Warehouse className="h-5 w-5 text-slate-400" />
              </div>
              
              {(w.contact_number || w.gstin) && (
                <div className="mt-2 text-xs text-slate-600 space-y-1">
                  {w.contact_number && <p>📞 {w.contact_number}</p>}
                  {w.gstin && <p>🏢 {w.gstin}</p>}
                </div>
              )}

              <div className="mt-4 flex justify-between items-center text-sm border-t border-slate-100 pt-3">
                <Badge variant="secondary" className="uppercase text-[10px] tracking-wider">{w.warehouse_type}</Badge>
                <Badge
                  className={
                    w.is_active
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-100'
                  }
                >
                  {w.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}