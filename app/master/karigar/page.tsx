'use client'

import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { 
  Plus, Search, User, Hammer, Phone, 
  Banknote, MoreVertical, Edit, Power,
  Briefcase, Hash
} from 'lucide-react'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// --- Zod Schema ---
const karigarSchema = z.object({
  karigar_code: z.string().min(2, 'Code is required').toUpperCase(),
  full_name: z.string().min(2, 'Name is required'),
  phone: z.string().min(10, 'Valid phone required').optional().or(z.literal('')),
  specialization: z.string().optional(),
  labor_type: z.enum(['PER_GRAM', 'PER_PIECE', 'FIXED']).default('PER_GRAM'),
  default_labor_rate: z.coerce.number().min(0).default(0),
  is_active: z.boolean().default(true)
})

export default function KarigarPage() {
  const { appUser } = useAuth()
  const [karigars, setKarigars] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [search, setSearch] = useState('')

  const form = useForm<z.infer<typeof karigarSchema>>({
    resolver: zodResolver(karigarSchema),
    defaultValues: { 
      karigar_code: '', 
      full_name: '',
      phone: '',
      specialization: '',
      labor_type: 'PER_GRAM', 
      default_labor_rate: 0,
      is_active: true 
    }
  })

  async function fetchKarigars() {
    if (!appUser) return
    setLoading(true)
    const { data, error } = await supabase
      .from('karigars')
      .select('*')
      .eq('company_id', appUser.company_id)
      .order('karigar_code', { ascending: true })

    if (data) setKarigars(data)
    setLoading(false)
  }

  useEffect(() => { fetchKarigars() }, [appUser])

  async function onSubmit(values: z.infer<typeof karigarSchema>) {
    if (!appUser) return
  
    try {
      const payload = {
        karigar_code: values.karigar_code,
        full_name: values.full_name,
        phone: values.phone,
        specialization: values.specialization,
        labor_type: values.labor_type,
        default_labor_rate: values.default_labor_rate,
        is_active: values.is_active
      }
  
      const { data, error } = await supabase.rpc(
        'create_karigar',
        {
          _payload: payload,
          _user_id: appUser.user_id
        }
      )
  
      if (error) throw error
  
      toast.success('Karigar Added Successfully')
  
      setIsSheetOpen(false)
      form.reset()
      fetchKarigars()
  
    } catch (err: any) {
      if (err.message?.includes('karigar_unique_code')) {
        toast.error('Karigar Code already exists for this company')
      } else {
        toast.error(err.message)
      }
    }
  }
  
  // Toggle Active Status
  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('karigars')
      .update({ is_active: !currentStatus })
      .eq('id', id)
    
    if (error) toast.error('Failed to update status')
    else {
      toast.success('Status updated')
      fetchKarigars()
    }
  }

  const filteredKarigars = karigars.filter(k => 
    k.full_name.toLowerCase().includes(search.toLowerCase()) ||
    k.karigar_code.toLowerCase().includes(search.toLowerCase()) ||
    k.specialization?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 max-w-7xl">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Karigars</h1>
          <p className="text-sm text-muted-foreground">Manage artisans and labor rates.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search Code, Name..." 
              className="pl-9 bg-white" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button className="bg-primary w-full sm:w-auto shadow-sm">
                <Plus className="mr-2 h-4 w-4" /> Add Karigar
              </Button>
            </SheetTrigger>
            
            <SheetContent side="right" className="w-[100%] sm:w-[500px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Add New Karigar</SheetTitle>
                <SheetDescription>
                  Register a new artisan. Set default labor rates for job cards.
                </SheetDescription>
              </SheetHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="karigar_code" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Karigar Code <span className="text-red-500">*</span></FormLabel>
                        <FormControl><Input placeholder="K-001" className="uppercase" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="full_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name <span className="text-red-500">*</span></FormLabel>
                        <FormControl><Input placeholder="Name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl><Input placeholder="+91..." type="tel" {...field} /></FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="specialization" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specialization</FormLabel>
                      <FormControl><Input placeholder="e.g. Setting, Polishing, Casting" {...field} /></FormControl>
                    </FormItem>
                  )} />

                  <div className="p-4 bg-slate-50 rounded-lg border space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2"><Banknote className="h-4 w-4" /> Labor Defaults</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="labor_type" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Charge Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Select Type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="PER_GRAM">Per Gram</SelectItem>
                              <SelectItem value="PER_PIECE">Per Piece</SelectItem>
                              <SelectItem value="FIXED">Fixed Salary</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      
                      <FormField control={form.control} name="default_labor_rate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Rate</FormLabel>
                          <FormControl><Input type="number" step="0.01" className="bg-white" {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Saving..." : "Save Karigar"}
                  </Button>
                </form>
              </Form>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* VIEW 1: DESKTOP TABLE */}
      <div className="hidden md:block rounded-md border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Code</TableHead>
              <TableHead>Karigar Name</TableHead>
              <TableHead>Specialization</TableHead>
              <TableHead>Standard Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell></TableRow>
            ) : filteredKarigars.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No karigars found.</TableCell></TableRow>
            ) : (
              filteredKarigars.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-mono font-medium text-primary">{k.karigar_code}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{k.full_name}</span>
                      <span className="text-xs text-muted-foreground">{k.phone || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {k.specialization ? <Badge variant="outline">{k.specialization}</Badge> : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="font-semibold">₹{k.default_labor_rate}</span>
                      <span className="text-muted-foreground text-xs ml-1 lowercase">
                        {k.labor_type.replace('_', ' ')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                     <Badge className={k.is_active ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-500 hover:bg-gray-100"}>
                        {k.is_active ? 'Active' : 'Inactive'}
                     </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <KarigarActions id={k.id} isActive={k.is_active} onToggle={() => toggleStatus(k.id, k.is_active)} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* VIEW 2: MOBILE CARDS */}
      <div className="md:hidden space-y-4">
        {loading ? <div className="text-center py-8">Loading...</div> : 
         filteredKarigars.length === 0 ? <div className="text-center py-8 border rounded bg-white">No Karigars</div> :
         filteredKarigars.map((k) => (
          <Card key={k.id} className="overflow-hidden border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                    {k.karigar_code.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{k.full_name}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Hash className="h-3 w-3" /> {k.karigar_code}
                    </div>
                  </div>
                </div>
                <KarigarActions id={k.id} isActive={k.is_active} onToggle={() => toggleStatus(k.id, k.is_active)} />
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Specialization</p>
                  <p className="font-medium">{k.specialization || 'General'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Rate</p>
                  <p className="font-medium text-green-700">₹{k.default_labor_rate} <span className="text-[10px] text-gray-500">/ {k.labor_type === 'PER_GRAM' ? 'gm' : 'pc'}</span></p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Subcomponent for cleaner JSX
function KarigarActions({ id, isActive, onToggle }: { id: string, isActive: boolean, onToggle: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <Edit className="mr-2 h-4 w-4" /> Edit Details
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Briefcase className="mr-2 h-4 w-4" /> Job History
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggle} className={isActive ? "text-red-600" : "text-green-600"}>
          <Power className="mr-2 h-4 w-4" /> {isActive ? 'Mark Inactive' : 'Mark Active'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}