'use client'

import React, { useEffect, useState } from 'react'
import { Navbar } from '@/components/AppSidebar'
import { useAuth } from '@/hooks/useAuth'
import { DataTable, Column } from '@/components/DataTable'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabaseClient'
import { fetchCustomers } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { useRpc } from '@/hooks/useRpc'
import { useToast } from '@/hooks/use-toast'

interface MemoTransaction {
  id: string
  memo_number: string
  customer_id: string
  status: string
  total_amount: number
  created_at: string
}

export default function MemoPage() {
  const { appUser, loading } = useAuth()
  const { callRpc } = useRpc()
  const { toast } = useToast()
  const [memos, setMemos] = useState<MemoTransaction[]>([])
  const [memosLoading, setMemosLoading] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [filterStatus, setFilterStatus] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState('')

  useEffect(() => {
    if (!appUser) return

    const fetchData = async () => {
      setMemosLoading(true)
      try {
        // Fetch memos
        const { data: memosData } = await supabase
          .from('memo_transactions')
          .select('*')
          .eq('company_id', appUser.company_id)
          .order('created_at', { ascending: false })

        setMemos(memosData || [])

        // Fetch customers
        const { data: customersData } = await fetchCustomers(appUser.company_id)
        setCustomers(customersData || [])
      } catch (err) {
        console.error('Error fetching memos:', err)
      } finally {
        setMemosLoading(false)
      }
    }

    fetchData()
  }, [appUser, filterStatus])

  const handleCreateMemo = async () => {
    if (!selectedCustomer || !appUser) {
      toast({ title: 'Error', description: 'Please select a customer' })
      return
    }

    setIsCreating(true)
    try {
      const { data, error } = await supabase.from('memo_transactions').insert({
        company_id: appUser.company_id,
        memo_number: `MEMO-${Date.now()}`,
        customer_id: selectedCustomer,
        status: 'open',
        total_amount: 0,
      })

      if (error) throw error

      toast({ title: 'Success', description: 'Memo created successfully' })

      // Reset
      setSelectedCustomer('')

      // Refresh
      const { data: refreshed } = await supabase
        .from('memo_transactions')
        .select('*')
        .eq('company_id', appUser.company_id)
        .order('created_at', { ascending: false })

      setMemos(refreshed || [])
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create memo',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleConvertMemo = async (memoId: string, action: 'to_sale' | 'to_return') => {
    if (!appUser) return

    try {
      const { data, error } = await callRpc('convert_memo_transaction', {
        p_memo_id: memoId,
        p_action: action,
        p_user_id: appUser.user_id,
      })

      if (error) throw error

      toast({ title: 'Success', description: `Memo converted to ${action}` })

      // Refresh
      const { data: refreshed } = await supabase
        .from('memo_transactions')
        .select('*')
        .eq('company_id', appUser.company_id)

      setMemos(refreshed || [])
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Conversion failed',
        variant: 'destructive',
      })
    }
  }

  const columns: Column<MemoTransaction>[] = [
    { key: 'memo_number', label: 'Memo #' },
    {
      key: 'customer_id',
      label: 'Customer',
      render: (value) => {
        const customer = customers.find((c) => c.id === value)
        return customer?.full_name || value
      },
    },
    {
      key: 'total_amount',
      label: 'Amount',
      render: (value) => `₹${value?.toLocaleString() || '0'}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <Badge variant={value === 'open' ? 'secondary' : 'default'}>
          {value}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (value) => new Date(value).toLocaleDateString(),
    },
  ]

  if (loading || !appUser) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar appUser={appUser} companyName="Memo Transactions" />

      <div className="lg:ml-64 p-4 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Memo Transactions</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Create Memo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Memo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Customer</label>
                  <select
                    className="w-full border rounded px-3 py-2 mt-1"
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                  >
                    <option value="">Select customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={handleCreateMemo}
                  disabled={isCreating}
                  className="w-full"
                >
                  {isCreating ? 'Creating...' : 'Create Memo'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <select
            className="w-full border rounded px-3 py-2"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="converted">Converted</option>
            <option value="closed">Closed</option>
          </select>
        </Card>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={memos}
          loading={memosLoading}
          emptyMessage="No memos found"
          actions={[
            {
              label: 'Convert to Sale',
              onClick: (row) => handleConvertMemo(row.id, 'to_sale'),
            },
            {
              label: 'Convert to Return',
              onClick: (row) => handleConvertMemo(row.id, 'to_return'),
            },
          ]}
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">
              {memos.filter((m) => m.status === 'open').length}
            </div>
            <p className="text-gray-600 text-sm mt-2">Open Memos</p>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600">
              {memos.filter((m) => m.status === 'converted').length}
            </div>
            <p className="text-gray-600 text-sm mt-2">Converted</p>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-gray-600">
              ₹{memos.reduce((sum, m) => sum + (m.total_amount || 0), 0).toLocaleString()}
            </div>
            <p className="text-gray-600 text-sm mt-2">Total Value</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
