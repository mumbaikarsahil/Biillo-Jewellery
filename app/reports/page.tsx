'use client'

import React, { useEffect, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { supabase } from '@/lib/supabaseClient'

export default function ReportsPage() {
  const { appUser, loading } = useAuth()
  const [reportData, setReportData] = useState<any>(null)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!appUser) return

    const fetchReportData = async () => {
      try {
        // Fetch daily sales
        const { data: salesData } = await supabase
          .from('sales_invoices')
          .select('created_at, total_amount')
          .eq('company_id', appUser.company_id)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

        // Fetch inventory by warehouse
        const { data: inventoryData } = await supabase
          .from('inventory_items')
          .select('warehouse_id, status')
          .eq('company_id', appUser.company_id)

        // Fetch warehouses
        const { data: warehouseData } = await supabase
          .from('warehouses')
          .select('id, name')
          .eq('company_id', appUser.company_id)

        // Process data for charts
        const dailySales = (salesData || []).reduce((acc: any, inv: any) => {
          const date = new Date(inv.created_at).toLocaleDateString()
          const existing = acc.find((d: any) => d.date === date)
          if (existing) {
            existing.amount += inv.total_amount || 0
          } else {
            acc.push({ date, amount: inv.total_amount || 0 })
          }
          return acc
        }, [])

        const inventoryByWarehouse = (warehouseData || []).map((wh: any) => {
          const count = (inventoryData || []).filter(
            (item: any) => item.warehouse_id === wh.id && item.status === 'in_stock'
          ).length
          return { name: wh.name, value: count }
        })

        const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

        setReportData({
          dailySales: dailySales.slice(-7), // Last 7 days
          inventoryByWarehouse,
          colors: COLORS,
          totalSales: (salesData || []).reduce((sum: number, inv: any) => sum + (inv.total_amount || 0), 0),
        })
      } catch (err) {
        console.error('Error fetching report data:', err)
      } finally {
        setDataLoading(false)
      }
    }

    fetchReportData()
  }, [appUser])

  if (loading || !appUser) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <div className="flex gap-2">
            <Button variant="outline">Export PDF</Button>
            <Button variant="outline">Export CSV</Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6">
            <div className="text-sm font-medium text-gray-600">Total Sales (30d)</div>
            <div className="text-3xl font-bold mt-2">
              ₹{dataLoading ? '-' : (reportData?.totalSales || 0).toLocaleString()}
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-medium text-gray-600">Avg Daily Sales</div>
            <div className="text-3xl font-bold mt-2">
              ₹{dataLoading ? '-' : ((reportData?.totalSales || 0) / 30).toLocaleString()}
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm font-medium text-gray-600">Pending Transfers</div>
            <div className="text-3xl font-bold mt-2 text-yellow-600">-</div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Daily Sales Trend */}
          <Card className="p-6">
            <h2 className="font-bold text-lg mb-4">Sales Trend (Last 7 Days)</h2>
            {dataLoading ? (
              <div className="h-64 flex items-center justify-center">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={reportData?.dailySales || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Inventory by Warehouse */}
          <Card className="p-6">
            <h2 className="font-bold text-lg mb-4">Inventory by Warehouse</h2>
            {dataLoading ? (
              <div className="h-64 flex items-center justify-center">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={reportData?.inventoryByWarehouse || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(reportData?.inventoryByWarehouse || []).map(
                      (_: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={reportData?.colors[index % reportData?.colors.length]}
                        />
                      )
                    )}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Detailed Reports Section */}
        <Card className="p-6">
          <h2 className="font-bold text-lg mb-4">Available Reports</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="justify-start h-auto flex-col items-start p-4">
              <div className="font-bold">Inventory Report</div>
              <div className="text-xs text-gray-600 mt-1">Items by status & warehouse</div>
            </Button>
            <Button variant="outline" className="justify-start h-auto flex-col items-start p-4">
              <div className="font-bold">Sales Report</div>
              <div className="text-xs text-gray-600 mt-1">Sales, returns, revenue</div>
            </Button>
            <Button variant="outline" className="justify-start h-auto flex-col items-start p-4">
              <div className="font-bold">Transfer Report</div>
              <div className="text-xs text-gray-600 mt-1">Movement & discrepancies</div>
            </Button>
            <Button variant="outline" className="justify-start h-auto flex-col items-start p-4">
              <div className="font-bold">Job Bag Report</div>
              <div className="text-xs text-gray-600 mt-1">Manufacturing status</div>
            </Button>
          </div>
        </Card>
      </div>
    
  )
}
