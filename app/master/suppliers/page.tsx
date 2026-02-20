'use client'

import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { 
  Plus, Search, Building2, Phone, Mail, MapPin, 
  CreditCard, Loader2, MoreVertical, Edit, Trash, 
  Save, Landmark
} from 'lucide-react'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// --- Zod Schema ---
const supplierSchema = z.object({
  supplier_name: z.string().min(2, 'Name is required'),
  contact_person: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(10, 'Valid phone number required'),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST Format').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  credit_days: z.coerce.number().min(0).default(0),
  bank_name: z.string().optional(),
  account_number: z.string().optional(),
  ifsc_code: z.string().optional(),
})

export default function SupplierPage() {
  const { appUser } = useAuth()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [search, setSearch] = useState('')

  const form = useForm<z.infer<typeof supplierSchema>>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { 
      supplier_name: '', 
      contact_person: '',
      phone: '',
      email: '',
      gstin: '',
      address: '',
      city: '',
      state: '',
      credit_days: 0,
      bank_name: '',
      account_number: '',
      ifsc_code: ''
    }
  })

  async function fetchSuppliers() {
    if (!appUser) return
    setLoading(true)
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', appUser.company_id)
      .order('created_at', { ascending: false })

    if (data) setSuppliers(data)
    setLoading(false)
  }

  useEffect(() => { fetchSuppliers() }, [appUser])

  async function onSubmit(values: z.infer<typeof supplierSchema>) {
    if (!appUser) return
  
    try {
      const payload = {
        supplier_name: values.supplier_name,
        contact_person: values.contact_person || null,
        phone: values.phone,
        email: values.email || null,
        gstin: values.gstin || null,
        address: values.address || null,
        city: values.city || null,
        state: values.state || null,
      }
  
      const { data: newId, error } = await supabase.rpc(
        'create_supplier',
        {
          _payload: payload,
          _user_id: appUser.user_id
        }
      )
  
      if (error) throw error
  
      toast.success('Supplier Registered Successfully')
  
      setIsSheetOpen(false)
      form.reset()
      fetchSuppliers()
  
    } catch (err: any) {
      toast.error(err.message || 'Failed to create supplier')
    }
  }
  
  const filteredSuppliers = suppliers.filter(s => 
    s.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
    s.gstin?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 max-w-7xl">
      
      {/* Responsive Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Manage vendor relationships.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              className="pl-9 bg-white" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button className="bg-primary w-full sm:w-auto shadow-sm">
                <Plus className="mr-2 h-4 w-4" /> Add Supplier
              </Button>
            </SheetTrigger>
            
            {/* Responsive Sheet Content */}
            <SheetContent side="right" className="w-[100%] sm:w-[540px] overflow-y-auto px-4 md:px-6">
              <SheetHeader className="text-left">
                <SheetTitle>New Supplier Registration</SheetTitle>
                <SheetDescription>
                  Enter vendor details. GSTIN is mandatory for tax credit.
                </SheetDescription>
              </SheetHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6 pb-8">
                  <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="basic">Basic Info</TabsTrigger>
                      <TabsTrigger value="finance">Financials</TabsTrigger>
                    </TabsList>

                    {/* BASIC INFO TAB */}
                    <TabsContent value="basic" className="space-y-4 mt-4">
                      <FormField control={form.control} name="supplier_name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name <span className="text-red-500">*</span></FormLabel>
                          <FormControl><Input placeholder="e.g. Malabar Gold" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="contact_person" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Person</FormLabel>
                            <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="phone" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone <span className="text-red-500">*</span></FormLabel>
                            <FormControl><Input placeholder="+91..." type="tel" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl><Input placeholder="email@example.com" type="email" {...field} /></FormControl>
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="address" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl><Input placeholder="Street Address" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="city" render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="state" render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                    </TabsContent>

                    {/* FINANCIAL TAB */}
                    <TabsContent value="finance" className="space-y-4 mt-4">
                      <FormField control={form.control} name="gstin" render={({ field }) => (
                        <FormItem>
                          <FormLabel>GSTIN</FormLabel>
                          <FormControl><Input placeholder="27ABCDE..." className="uppercase" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                       <FormField control={form.control} name="credit_days" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Credit Period (Days)</FormLabel>
                          <FormControl><Input type="number" {...field} /></FormControl>
                        </FormItem>
                      )} />

                      <div className="border rounded-lg p-4 bg-slate-50/50">
                        <h4 className="font-medium mb-3 flex items-center gap-2 text-sm text-slate-700">
                          <CreditCard className="h-4 w-4" /> Bank Details
                        </h4>
                        <div className="space-y-3">
                          <FormField control={form.control} name="bank_name" render={({ field }) => (
                            <FormItem>
                              <FormControl><Input placeholder="Bank Name" {...field} className="bg-white" /></FormControl>
                            </FormItem>
                          )} />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                             <FormField control={form.control} name="account_number" render={({ field }) => (
                              <FormItem>
                                <FormControl><Input placeholder="Account No" {...field} className="bg-white" /></FormControl>
                              </FormItem>
                            )} />
                             <FormField control={form.control} name="ifsc_code" render={({ field }) => (
                              <FormItem>
                                <FormControl><Input placeholder="IFSC" className="uppercase bg-white" {...field} /></FormControl>
                              </FormItem>
                            )} />
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                     {form.formState.isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                     Register Supplier
                  </Button>
                </form>
              </Form>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* VIEW 1: DESKTOP TABLE (Hidden on Mobile) */}
      <div className="hidden md:block rounded-md border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="animate-spin h-6 w-6 mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredSuppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No suppliers found.
                </TableCell>
              </TableRow>
            ) : (
              filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                       <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                          <Building2 className="h-4 w-4" />
                       </div>
                       {supplier.supplier_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-sm">
                      <div className="flex items-center gap-1 text-gray-700 font-medium">{supplier.phone}</div>
                      {supplier.email && <div className="text-gray-500 text-xs">{supplier.email}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {supplier.gstin ? (
                      <Badge variant="outline" className="font-mono bg-slate-50">{supplier.gstin}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {supplier.city ? (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                         {supplier.city}, {supplier.state}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={supplier.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                      {supplier.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <SupplierActions />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* VIEW 2: MOBILE CARDS (Visible only on Mobile) */}
      <div className="md:hidden space-y-4">
        {loading ? (
           <div className="flex justify-center py-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
        ) : filteredSuppliers.length === 0 ? (
           <div className="text-center py-8 text-muted-foreground border rounded-lg bg-white">No suppliers found.</div>
        ) : (
          filteredSuppliers.map((supplier) => (
            <Card key={supplier.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{supplier.supplier_name}</h3>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {supplier.city || 'No Location'}, {supplier.state}
                      </div>
                    </div>
                  </div>
                  <SupplierActions />
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm mt-4 pt-4 border-t">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Contact</p>
                    <p className="font-medium flex items-center gap-1">
                       <Phone className="h-3 w-3" /> {supplier.phone}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">GSTIN</p>
                    {supplier.gstin ? (
                      <p className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded w-fit">{supplier.gstin}</p>
                    ) : (
                      <p className="text-gray-400 italic">N/A</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

    </div>
  )
}

function SupplierActions() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="cursor-pointer">
          <Edit className="mr-2 h-4 w-4" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer">
          <Landmark className="mr-2 h-4 w-4" /> View Ledger
        </DropdownMenuItem>
         <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600">
          <Trash className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}