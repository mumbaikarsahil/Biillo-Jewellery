'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { Plus, Warehouse, Search, Edit2, MapPin, Phone, ShieldCheck, Store } from 'lucide-react'

// 1. UPDATE ZOD SCHEMA TO INCLUDE STATUS
const warehouseSchema = z.object({
  warehouse_code: z.string().min(2, 'Code required'),
  name: z.string().min(2, 'Name required'),
  warehouse_type: z.enum(['main_safe', 'factory', 'branch', 'transit']),
  address: z.string().optional(),
  contact_number: z.string().optional(),
  gstin: z.string().optional(),
  is_active: z.boolean().default(true) // <-- Added for edit mode
})

export default function WarehousePage() {
  const { appUser } = useAuth()
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  
  // --- NEW: EDIT STATE ---
  const [editingId, setEditingId] = useState<string | null>(null)

  const defaultValues = {
    warehouse_code: '',
    name: '',
    warehouse_type: 'branch' as const,
    address: '',
    contact_number: '',
    gstin: '',
    is_active: true
  }

  const form = useForm<z.infer<typeof warehouseSchema>>({
    resolver: zodResolver(warehouseSchema),
    defaultValues
  })

  async function fetchWarehouses() {
    if (!appUser) return
    setLoading(true)

    const { data } = await supabase
      .from('warehouses')
      .select('*')
      .eq('company_id', appUser.company_id)
      .order('is_active', { ascending: false }) // Active first
      .order('created_at', { ascending: false })

    setWarehouses(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchWarehouses()
  }, [appUser])

  // --- NEW: HANDLE OPENING EDIT SHEET ---
  const openEditSheet = (w: any) => {
    setEditingId(w.id)
    form.reset({
      warehouse_code: w.warehouse_code || '',
      name: w.name || '',
      warehouse_type: w.warehouse_type || 'branch',
      address: w.address || '',
      contact_number: w.contact_number || '',
      gstin: w.gstin || '',
      is_active: w.is_active
    })
    setIsSheetOpen(true)
  }

  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open)
    if (!open) {
      // Reset form when closing
      setTimeout(() => {
        setEditingId(null)
        form.reset(defaultValues)
      }, 200)
    }
  }

  async function onSubmit(values: z.infer<typeof warehouseSchema>) {
    if (!appUser) return

    try {
      if (editingId) {
        // --- UPDATE EXISTING WAREHOUSE ---
        const { error } = await supabase
          .from('warehouses')
          .update({
            warehouse_code: values.warehouse_code,
            name: values.name,
            warehouse_type: values.warehouse_type,
            address: values.address,
            contact_number: values.contact_number,
            gstin: values.gstin,
            is_active: values.is_active
          })
          .eq('id', editingId)
          .eq('company_id', appUser.company_id) // Security check

        if (error) throw error
        toast.success('Warehouse Updated Successfully')
      } else {
        // --- CREATE NEW WAREHOUSE ---
        const { error } = await supabase.rpc('create_warehouse', {
          _user_id: appUser.user_id,
          _warehouse_code: values.warehouse_code,
          _name: values.name,
          _warehouse_type: values.warehouse_type,
          _address: values.address,            
          _contact_number: values.contact_number, 
          _gstin: values.gstin                 
        })

        if (error) throw error
        toast.success('Warehouse Created Successfully')
      }

      handleSheetOpenChange(false)
      fetchWarehouses()
    } catch (err: any) {
      if (err.message?.includes('idx_warehouse_company_code') || err.message?.includes('unique')) {
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
    <div className="flex flex-col min-h-screen bg-zinc-50/50 font-sans pb-20">

      {/* HEADER */}
      <header className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 sm:px-6 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Store className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-sm font-semibold text-zinc-900 tracking-tight">Location Master</h1>
        </div>
      </header>

      <main className="p-4 sm:p-6 md:p-8 max-w-[1400px] w-full mx-auto space-y-6">

        {/* TOOLBAR */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search branch or code..."
              className="pl-9 h-10 rounded-xl bg-zinc-50 border-zinc-200 focus-visible:ring-zinc-400 font-medium text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
            <SheetTrigger asChild>
              <Button className="h-10 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 px-6 font-bold w-full md:w-auto shadow-sm">
                <Plus className="mr-2 h-4 w-4" /> Add Location
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-full sm:w-[450px] overflow-y-auto border-l border-zinc-200 shadow-2xl p-0">
              <SheetHeader className="p-6 border-b border-zinc-100 bg-zinc-50/50">
                <SheetTitle className="text-xl font-bold tracking-tight text-zinc-900">
                  {editingId ? 'Edit Location' : 'New Location'}
                </SheetTitle>
              </SheetHeader>

              <div className="p-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="warehouse_code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Code *</FormLabel>
                            <FormControl>
                              <Input {...field} className="uppercase font-mono bg-zinc-50 h-10" placeholder="BR-01" disabled={!!editingId} />
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
                            <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Type *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-10 bg-zinc-50 font-medium">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="main_safe">Main Safe</SelectItem>
                                <SelectItem value="factory">Factory</SelectItem>
                                <SelectItem value="branch">Retail Branch</SelectItem>
                                <SelectItem value="transit">Transit Hub</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Location Name *</FormLabel>
                          <FormControl>
                            <Input {...field} className="h-10 font-medium" placeholder="e.g. Andheri West Showroom" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Address & Contact */}
                    <div className="pt-4 border-t border-zinc-100 space-y-5">
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Full Address (For Invoices)</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="Enter complete billing/shipping address..." 
                                className="resize-none h-20 text-sm bg-zinc-50" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="contact_number"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Phone</FormLabel>
                              <FormControl>
                                <Input {...field} className="h-10 bg-zinc-50 text-sm" placeholder="+91 9876543210" />
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
                              <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">GSTIN</FormLabel>
                              <FormControl>
                                <Input {...field} className="uppercase h-10 bg-zinc-50 font-mono text-sm" placeholder="27AAOP..." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Status Toggle (Only show in edit mode) */}
                    {editingId && (
                      <div className="pt-4 border-t border-zinc-100">
                        <FormField
                          control={form.control}
                          name="is_active"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Operational Status</FormLabel>
                              <Select onValueChange={(val) => field.onChange(val === 'true')} value={field.value ? 'true' : 'false'}>
                                <FormControl>
                                  <SelectTrigger className={`h-10 font-bold ${field.value ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-zinc-500 bg-zinc-100 border-zinc-200'}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="true" className="font-bold text-emerald-700">Active / Operational</SelectItem>
                                  <SelectItem value="false" className="font-bold text-zinc-500">Inactive / Closed</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    <div className="pt-6">
                      <Button type="submit" className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-widest text-xs shadow-md">
                        {editingId ? 'Save Changes' : 'Create Location'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block border border-zinc-200 rounded-2xl bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <Table>
            <TableHeader className="bg-zinc-50/80">
              <TableRow className="border-zinc-200 hover:bg-transparent">
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-6 w-24">Code</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Branch Details</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider w-40">Classification</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Contact & Tax</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-center w-28">Status</TableHead>
                <TableHead className="h-11 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right pr-6 w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-zinc-400">Loading locations...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-zinc-400">No locations match your search.</TableCell>
                </TableRow>
              ) : (
                filtered.map((w) => (
                  <TableRow key={w.id} className={`border-zinc-100 hover:bg-zinc-50/50 transition-colors ${!w.is_active && 'opacity-60 bg-zinc-50/50'}`}>
                    <TableCell className="pl-6 py-4">
                      <span className="font-mono font-bold text-xs text-zinc-900 bg-zinc-100 px-2 py-1 rounded">
                        {w.warehouse_code}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-sm text-zinc-900">{w.name}</span>
                        <div className="flex items-start gap-1.5 text-xs text-zinc-500 max-w-sm">
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-50" />
                          <span className="truncate">{w.address || 'No address set'}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className="uppercase text-[9px] font-bold tracking-widest text-zinc-600 border-zinc-200 bg-white">
                        {w.warehouse_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
                        {w.contact_number && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-zinc-400"/> {w.contact_number}</span>}
                        {w.gstin && <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-zinc-400"/> <span className="font-mono">{w.gstin}</span></span>}
                        {!w.contact_number && !w.gstin && <span className="text-zinc-400 italic text-[10px]">No info provided</span>}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <Badge
                        className={`text-[9px] font-bold uppercase tracking-widest border ${
                          w.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                        }`}
                      >
                        {w.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 pr-6 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" onClick={() => openEditSheet(w)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* MOBILE CARDS */}
        <div className="md:hidden flex flex-col gap-3">
          {filtered.map((w) => (
            <Card key={w.id} className={`rounded-xl border-zinc-200 shadow-sm ${!w.is_active && 'opacity-70 bg-zinc-50'}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">{w.name}</h3>
                    <span className="font-mono font-bold text-[10px] text-zinc-500 tracking-wider">
                      {w.warehouse_code}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs font-bold text-indigo-600 border-indigo-200 bg-indigo-50" onClick={() => openEditSheet(w)}>
                    <Edit2 className="w-3 h-3 mr-1" /> Edit
                  </Button>
                </div>
                
                <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-100 space-y-2 mb-3">
                  <div className="flex items-start gap-2 text-xs text-zinc-600">
                    <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-400" />
                    <span className="leading-snug">{w.address || 'No address set'}</span>
                  </div>
                  {(w.contact_number || w.gstin) && (
                    <div className="pt-2 mt-2 border-t border-zinc-200/50 flex flex-col gap-1 text-xs text-zinc-600">
                      {w.contact_number && <span className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-zinc-400"/> {w.contact_number}</span>}
                      {w.gstin && <span className="flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-zinc-400"/> <span className="font-mono">{w.gstin}</span></span>}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <Badge variant="outline" className="uppercase text-[9px] font-bold tracking-widest text-zinc-500 bg-white border-zinc-200">
                    {w.warehouse_type.replace('_', ' ')}
                  </Badge>
                  <Badge
                    className={`text-[9px] font-bold uppercase tracking-widest border ${
                      w.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                    }`}
                  >
                    {w.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}