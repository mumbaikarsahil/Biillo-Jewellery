'use client'

import React, { useEffect, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { DataTable, Column } from '@/components/DataTable'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { fetchInventoryItems, fetchWarehouses } from '@/lib/api'
import { Badge } from '@/components/ui/badge'

interface InventoryItem {
  id: string
  barcode: string
  sku_reference: string
  metal_type: string
  gross_weight_g: number
  net_weight_g: number
  mrp: number
  status: string
  warehouse_id: string
}

export default function InventoryPage() {
  const { appUser, loading } = useAuth()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    if (!appUser) return

    const fetchData = async () => {
      setItemsLoading(true)
      try {
        // Fetch warehouses
        const { data: warehouseData } = await fetchWarehouses(appUser.company_id)
        setWarehouses(warehouseData || [])

        // Fetch inventory items
        const { data: itemsData } = await fetchInventoryItems(appUser.company_id, {
          status: filterStatus || undefined,
        })

        setItems(itemsData || [])
      } catch (err) {
        console.error('Error fetching inventory:', err)
      } finally {
        setItemsLoading(false)
      }
    }

    fetchData()
  }, [appUser, filterStatus])

  const columns: Column<InventoryItem>[] = [
    { key: 'barcode', label: 'Barcode', width: '150px' },
    { key: 'metal_type', label: 'Metal', width: '100px' },
    { key: 'gross_weight_g', label: 'Gross Weight (g)', width: '150px' },
    {
      key: 'mrp',
      label: 'MRP',
      render: (value) => `₹${value?.toLocaleString() || '0'}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <Badge
          variant={
            value === 'in_stock'
              ? 'default'
              : value === 'transit'
                ? 'secondary'
                : 'outline'
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

  return (
    <div className="space-y-8 p-4 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Inventory Items</h1>
          <Button asChild>
            <Link href="/inventory/gold-batches">Add Gold Batch</Link>
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Search by Barcode</label>
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="in_stock">In Stock</option>
                <option value="transit">In Transit</option>
                <option value="sold">Sold</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" className="w-full">
                Apply Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={items}
          loading={itemsLoading}
          emptyMessage="No inventory items found"
          onRowClick={(row) => {
            // Navigate to item detail
          }}
          actions={[
            {
              label: 'View',
              onClick: (row) => {
                // Handle view
              },
            },
            {
              label: 'Transfer',
              onClick: (row) => {
                // Handle transfer
              },
            },
          ]}
        />

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">{items.length}</div>
            <p className="text-gray-600 text-sm mt-2">Total Items</p>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-green-600">
              {items.filter((i) => i.status === 'in_stock').length}
            </div>
            <p className="text-gray-600 text-sm mt-2">In Stock</p>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-yellow-600">
              {items.filter((i) => i.status === 'transit').length}
            </div>
            <p className="text-gray-600 text-sm mt-2">In Transit</p>
          </Card>
        </div>
    </div>
  )
}
