'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

const warehouseSchema = z.object({
  warehouse_code: z.string().min(2, 'Code required'),
  name: z.string().min(2, 'Name required'),
  warehouse_type: z.enum(['main_safe', 'factory', 'branch', 'transit']),
})

export default function WarehousePage() {
  const { appUser } = useAuth()
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const form = useForm<z.infer<typeof warehouseSchema>>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      warehouse_code: '',
      name: '',
      warehouse_type: 'branch',
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
      const { error } = await supabase.rpc('create_warehouse', {
        _user_id: appUser.user_id,
        _warehouse_code: values.warehouse_code,
        _name: values.name,
        _warehouse_type: values.warehouse_type,
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

            <SheetContent side="right" className="w-full sm:w-[450px]">
              <SheetHeader>
                <SheetTitle>Create Warehouse</SheetTitle>
              </SheetHeader>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6 mt-6"
                >
                  <FormField
                    control={form.control}
                    name="warehouse_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warehouse Code</FormLabel>
                        <FormControl>
                          <Input {...field} className="uppercase" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warehouse Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                        <FormLabel>Type</FormLabel>
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
                            <SelectItem value="main_safe">
                              Main Safe
                            </SelectItem>
                            <SelectItem value="factory">
                              Factory
                            </SelectItem>
                            <SelectItem value="branch">
                              Branch
                            </SelectItem>
                            <SelectItem value="transit">
                              Transit
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full">
                    Create Warehouse
                  </Button>
                </form>
              </Form>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block border rounded bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4}>Loading...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>No warehouses found</TableCell>
              </TableRow>
            ) : (
              filtered.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-mono">
                    {w.warehouse_code}
                  </TableCell>
                  <TableCell>{w.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{w.warehouse_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        w.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
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
                  <h3 className="font-bold">{w.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {w.warehouse_code}
                  </p>
                </div>
                <Warehouse className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <Badge variant="outline">{w.warehouse_type}</Badge>
                <Badge
                  className={
                    w.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
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
