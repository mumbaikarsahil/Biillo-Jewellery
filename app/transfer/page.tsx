'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { DataTable, Column } from '@/components/DataTable'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { fetchStockTransfers, createStockTransfer, fetchWarehouses } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { useRpc } from '@/hooks/useRpc'
import { useToast } from '@/hooks/use-toast'

interface Transfer {
  id: string
  transfer_number: string
  from_warehouse_id: string
  to_warehouse_id: string
  status: string
  created_at: string
}

export default function TransferPage() {
  const { appUser, loading } = useAuth()
  const { callRpc } = useRpc()
  const { toast } = useToast()
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [transfersLoading, setTransfersLoading] = useState(false)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [filterStatus, setFilterStatus] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Form state
  const [transferNumber, setTransferNumber] = useState('')
  const [fromWarehouseId, setFromWarehouseId] = useState('')
  const [toWarehouseId, setToWarehouseId] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!appUser) return

    const fetchData = async () => {
      setTransfersLoading(true)
      try {
        // Fetch warehouses
        const { data: warehouseData } = await fetchWarehouses(appUser.company_id)
        setWarehouses(warehouseData || [])

        // Fetch transfers
        const { data: transfersData } = await fetchStockTransfers(
          appUser.company_id,
          filterStatus || undefined
        )

        setTransfers(transfersData || [])
      } catch (err) {
        console.error('Error fetching transfers:', err)
      } finally {
        setTransfersLoading(false)
      }
    }

    fetchData()
  }, [appUser, filterStatus])

  const handleCreateTransfer = async () => {
    if (!fromWarehouseId || !toWarehouseId || !appUser) {
      toast({ title: 'Error', description: 'Please fill all required fields' })
      return
    }

    setIsCreating(true)
    try {
      const { data, error } = await createStockTransfer(appUser.company_id, {
        transfer_number: transferNumber || `TRF-${Date.now()}`,
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        notes,
      })

      if (error) throw error

      toast({ title: 'Success', description: 'Transfer created successfully' })
      
      // Reset form
      setTransferNumber('')
      setFromWarehouseId('')
      setToWarehouseId('')
      setNotes('')

      // Refresh transfers
      const { data: refreshed } = await fetchStockTransfers(appUser.company_id)
      setTransfers(refreshed || [])
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create transfer',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const columns: Column<Transfer>[] = [
    { key: 'transfer_number', label: 'Transfer #' },
    {
      key: 'created_at',
      label: 'Date',
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <Badge
          variant={
            value === 'draft'
              ? 'outline'
              : value === 'dispatched'
                ? 'secondary'
                : 'default'
          }
        >
          {value}
        </Badge>
      ),
    },
  ]

  if (loading || !appUser) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  const getWarehouseName = (id: string) => {
    return warehouses.find((w) => w.id === id)?.name || id
  }

  return (
    <div className="min-h-screen bg-gray-50">

      <div className="lg:ml-64 p-4 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Stock Transfers</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Create Transfer</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Transfer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">From Warehouse</label>
                  <select
                    className="w-full border rounded px-3 py-2 mt-1"
                    value={fromWarehouseId}
                    onChange={(e) => setFromWarehouseId(e.target.value)}
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">To Warehouse</label>
                  <select
                    className="w-full border rounded px-3 py-2 mt-1"
                    value={toWarehouseId}
                    onChange={(e) => setToWarehouseId(e.target.value)}
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Input
                    placeholder="Optional notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleCreateTransfer}
                  disabled={isCreating}
                  className="w-full"
                >
                  {isCreating ? 'Creating...' : 'Create Transfer'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium">Status</label>
              <select
                className="w-full border rounded px-3 py-2 mt-1"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="dispatched">Dispatched</option>
                <option value="received">Received</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={transfers}
          loading={transfersLoading}
          emptyMessage="No transfers found"
          actions={[
            {
              label: 'View Details',
              onClick: (row) => {
                // Navigate to detail page
              },
            },
          ]}
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">
              {transfers.filter((t) => t.status === 'draft').length}
            </div>
            <p className="text-gray-600 text-sm mt-2">Draft</p>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-yellow-600">
              {transfers.filter((t) => t.status === 'dispatched').length}
            </div>
            <p className="text-gray-600 text-sm mt-2">Dispatched</p>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600">
              {transfers.filter((t) => t.status === 'received').length}
            </div>
            <p className="text-gray-600 text-sm mt-2">Received</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
