'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { 
  Package, 
  Truck, 
  FileText, 
  IndianRupee, 
  ArrowUpRight, 
  Settings, 
  Users, 
  Warehouse,
  Plus,
  Scan
} from 'lucide-react'

// Recharts
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export default function Dashboard() {
  const router = useRouter()
  const { appUser, loading, error } = useAuth()
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [dataLoading, setDataLoading] = useState(true)

  // Mock data for the chart
  const chartData = [
    { name: 'Mon', total: 1200 },
    { name: 'Tue', total: 2100 },
    { name: 'Wed', total: 800 },
    { name: 'Thu', total: 1600 },
    { name: 'Fri', total: 2400 },
    { name: 'Sat', total: 3200 },
    { name: 'Sun', total: dashboardData?.todaysSales || 1500 },
  ]

  useEffect(() => {
    if (!appUser) return

    const fetchDashboardData = async () => {
      try {
        const [
          { data: itemCount },
          { data: transitCount },
          { data: transferStats },
          { data: salesData },
        ] = await Promise.all([
          supabase.from('inventory_items').select('count', { count: 'exact' }).eq('company_id', appUser.company_id).eq('status', 'in_stock'),
          supabase.from('inventory_items').select('count', { count: 'exact' }).eq('company_id', appUser.company_id).eq('status', 'transit'),
          supabase.from('stock_transfers').select('status').eq('company_id', appUser.company_id),
          supabase.from('sales_invoices').select('total_amount').eq('company_id', appUser.company_id).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        ])

        const totalSales = salesData?.reduce((sum: number, inv: any) => sum + (inv.total_amount || 0), 0) || 0

        setDashboardData({
          itemCount: itemCount?.[0]?.count || 0,
          transitCount: transitCount?.[0]?.count || 0,
          pendingDispatches: transferStats?.filter((t: any) => t.status === 'draft').length || 0,
          todaysSales: totalSales,
        })
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
      } finally {
        setDataLoading(false)
      }
    }

    fetchDashboardData()
  }, [appUser])

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    )
  }

  if (error || !appUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-destructive">Authentication Error</CardTitle>
            <CardDescription>{error || 'Please log in to continue'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/login')} className="w-full">
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50/50 p-4 md:p-8">
      {/* Top Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Overview for <span className="font-semibold text-gray-700">{appUser.full_name || 'User'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="bg-primary shadow-sm hover:bg-primary/90 w-full md:w-auto">
             <Plus className="mr-2 h-4 w-4" /> New Order
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid - Always at top */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          title="Total Revenue"
          value={`₹${(dashboardData?.todaysSales || 0).toLocaleString()}`}
          description="Sales generated today"
          icon={IndianRupee}
          loading={dataLoading}
          trend="+12%"
          trendUp={true}
        />
        <StatCard
          title="In Stock"
          value={dashboardData?.itemCount || 0}
          description="Total items available"
          icon={Package}
          loading={dataLoading}
        />
        <StatCard
          title="In Transit"
          value={dashboardData?.transitCount || 0}
          description="Stock currently moving"
          icon={Truck}
          loading={dataLoading}
          className="border-l-4 border-l-amber-500"
        />
        <StatCard
          title="Pending Actions"
          value={dashboardData?.pendingDispatches || 0}
          description="Draft transfers"
          icon={FileText}
          loading={dataLoading}
          className="border-l-4 border-l-orange-500"
        />
      </div>

      {/* Main Content Grid: Uses 'order' classes to rearrange on mobile */}
      <div className="grid gap-4 lg:grid-cols-7">
        
        {/* QUICK ACTIONS SECTION
          Mobile: order-1 (appears first)
          Desktop: lg:order-2 (appears on the right)
        */}
        <div className="order-1 col-span-1 grid gap-4 lg:order-2 lg:col-span-3">
          
          {/* Quick Actions Panel */}
          <Card className="shadow-sm border-indigo-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Link href="/pos" className="contents">
                <div className="group flex cursor-pointer flex-col items-center justify-center rounded-lg border border-indigo-50 bg-indigo-50/50 p-4 text-center transition-all hover:bg-indigo-100 active:scale-95">
                  <Scan className="mb-2 h-6 w-6 text-indigo-600" />
                  <span className="text-sm font-semibold text-indigo-900">POS</span>
                </div>
              </Link>
              <Link href="/transfer" className="contents">
                <div className="group flex cursor-pointer flex-col items-center justify-center rounded-lg border border-amber-50 bg-amber-50/50 p-4 text-center transition-all hover:bg-amber-100 active:scale-95">
                  <ArrowUpRight className="mb-2 h-6 w-6 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-900">Transfer</span>
                </div>
              </Link>
              <Link href="/inventory" className="contents">
                <div className="group flex cursor-pointer flex-col items-center justify-center rounded-lg border border-emerald-50 bg-emerald-50/50 p-4 text-center transition-all hover:bg-emerald-100 active:scale-95">
                  <Package className="mb-2 h-6 w-6 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-900">Stock</span>
                </div>
              </Link>
               <Link href="/master/company" className="contents">
                <div className="group flex cursor-pointer flex-col items-center justify-center rounded-lg border border-slate-50 bg-slate-100 p-4 text-center transition-all hover:bg-slate-200 active:scale-95">
                  <Settings className="mb-2 h-6 w-6 text-slate-600" />
                  <span className="text-sm font-semibold text-slate-900">Setup</span>
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* System Health (Hidden on small mobile to save space, visible on larger screens) */}
          <Card className="shadow-sm hidden md:block">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">System Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                      <Users size={16} />
                    </div>
                    <span className="text-sm font-medium">Role</span>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-slate-700">
                    {appUser.role}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                      <Warehouse size={16} />
                    </div>
                    <span className="text-sm font-medium">Warehouses</span>
                  </div>
                   <span className="text-sm font-bold text-gray-900">
                    {appUser.warehouse_ids?.length || 0} Active
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CHART SECTION 
          Mobile: order-2 (appears second)
          Desktop: lg:order-1 (appears on the left)
        */}
        <Card className="order-2 col-span-1 shadow-sm lg:order-1 lg:col-span-4">
          <CardHeader>
            <CardTitle>Sales Overview</CardTitle>
            <CardDescription>Revenue performance over the last 7 days.</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`₹${value}`, 'Revenue']}
                  />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <Area type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

// --- Subcomponent ---

interface StatCardProps {
  title: string
  value: string | number
  description: string
  icon: React.ElementType
  loading: boolean
  trend?: string
  trendUp?: boolean
  className?: string
}

function StatCard({ title, value, description, icon: Icon, loading, trend, trendUp, className }: StatCardProps) {
  return (
    <Card className={`overflow-hidden shadow-sm ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {loading ? <div className="h-8 w-24 animate-pulse rounded bg-gray-200" /> : value}
        </div>
        <div className="mt-1 flex items-center text-xs text-muted-foreground">
          {trend && (
            <span className={`mr-1 font-medium ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
              {trend}
            </span>
          )}
          <span>{description}</span>
        </div>
      </CardContent>
    </Card>
  )
}