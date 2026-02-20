'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { DataTable, Column } from '@/components/DataTable'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabaseClient'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useRpc } from '@/hooks/useRpc'
import { FileText, RotateCcw, TrendingUp, Printer, Eye, CheckCircle } from 'lucide-react'

interface Invoice {
  id: string
  invoice_number: string
  customer_id: string
  total_amount: number
  status: string
  created_at: string
}

interface SalesReturn {
  id: string
  return_number: string
  invoice_id: string
  status: string
  refund_amount: number
  created_at: string
}

export default function SalesPage() {
  const { appUser, loading } = useAuth()
  const { toast } = useToast()
  const { callRpc } = useRpc()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [returns, setReturns] = useState<SalesReturn[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [returnsLoading, setReturnsLoading] = useState(false)

  useEffect(() => {
    if (!appUser) return

    const fetchData = async () => {
      setInvoicesLoading(true)
      setReturnsLoading(true)
      try {
        // Fetch invoices
        const { data: invoicesData } = await supabase
          .from('sales_invoices')
          .select('*')
          .eq('company_id', appUser.company_id)
          .order('created_at', { ascending: false })

        setInvoices(invoicesData || [])

        // Fetch returns
        const { data: returnsData } = await supabase
          .from('sales_returns')
          .select('*')
          .eq('company_id', appUser.company_id)
          .order('created_at', { ascending: false })

        setReturns(returnsData || [])
      } catch (err) {
        console.error('Error fetching sales data:', err)
      } finally {
        setInvoicesLoading(false)
        setReturnsLoading(false)
      }
    }

    fetchData()
  }, [appUser])

  const handleCompleteReturn = async (returnId: string) => {
    if (!appUser) return

    try {
      const { data, error } = await callRpc('complete_sales_return', {
        p_return_id: returnId,
        p_user_id: appUser.user_id,
      })

      if (error) throw error

      toast({ title: 'Success', description: 'Return processed successfully' })

      // Refresh returns
      const { data: refreshed } = await supabase
        .from('sales_returns')
        .select('*')
        .eq('company_id', appUser.company_id)
        .order('created_at', { ascending: false })

      setReturns(refreshed || [])
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to process return',
        variant: 'destructive',
      })
    }
  }

  const invoiceColumns: Column<Invoice>[] = [
    { key: 'invoice_number', label: 'Invoice #' },
    {
      key: 'total_amount',
      label: 'Amount',
      render: (value) => <span className="font-mono font-medium">₹{value?.toLocaleString() || '0'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <Badge variant={value === 'completed' ? 'default' : 'secondary'} className="capitalize">
          {value}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (value) => <span className="text-gray-500">{new Date(value).toLocaleDateString()}</span>,
    },
  ]

  const returnColumns: Column<SalesReturn>[] = [
    { key: 'return_number', label: 'Return #' },
    {
      key: 'refund_amount',
      label: 'Refund Amount',
      render: (value) => <span className="font-mono font-medium text-red-600">-₹{value?.toLocaleString() || '0'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <Badge variant={value === 'completed' ? 'default' : 'secondary'} className="capitalize">
          {value}
        </Badge>
      ),
    },
  ]

  if (loading || !appUser) {
    return <div className="flex items-center justify-center min-h-[50vh] text-gray-500">Loading Sales Data...</div>
  }

  const totalSales = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
  const totalReturns = returns.reduce((sum, ret) => sum + (ret.refund_amount || 0), 0)

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales & Returns</h1>
          <p className="text-muted-foreground">Manage invoices, credit notes, and customer refunds.</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalSales.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {invoices.length} invoices generated
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Returns Processed</CardTitle>
              <RotateCcw className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">₹{totalReturns.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {returns.length} returns processed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Sales</CardTitle>
              <FileText className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                ₹{(totalSales - totalReturns).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Revenue after returns deduction
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs & Tables */}
        <Tabs defaultValue="invoices" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="invoices">Sales Invoices</TabsTrigger>
              <TabsTrigger value="returns">Sales Returns</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
                 <Button variant="outline" size="sm">
                   <FileText className="w-4 h-4 mr-2" />
                   New Invoice
                 </Button>
                 <Button variant="outline" size="sm">
                   <RotateCcw className="w-4 h-4 mr-2" />
                   New Return
                 </Button>
            </div>
          </div>

          <TabsContent value="invoices">
            <Card>
               <CardContent className="p-0">
                  <DataTable
                    columns={invoiceColumns}
                    data={invoices}
                    loading={invoicesLoading}
                    emptyMessage="No sales invoices found for this period."
                    actions={[
                      {
                        label: 'View',
                        icon: Eye,
                        onClick: (row) => {
                          toast({ description: `Viewing invoice ${row.invoice_number}` })
                        },
                      },
                      {
                        label: 'Print',
                        icon: Printer,
                        onClick: (row) => {
                          toast({ title: 'Printing...', description: `Sent ${row.invoice_number} to printer` })
                        },
                      },
                    ]}
                  />
               </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="returns">
             <Card>
                <CardContent className="p-0">
                  <DataTable
                    columns={returnColumns}
                    data={returns}
                    loading={returnsLoading}
                    emptyMessage="No sales returns found."
                    actions={[
                      {
                        label: 'Process Refund',
                        icon: CheckCircle,
                        onClick: (row) => {
                          if (row.status !== 'completed') {
                            handleCompleteReturn(row.id)
                          }
                        },
                        // Only show action if not completed (logic handled inside onClick usually, or UI can hide it)
                      },
                    ]}
                  />
                </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
    </div>
  )
}