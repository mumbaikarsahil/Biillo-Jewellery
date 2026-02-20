'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Scanner } from '@/components/Scanner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabaseClient'
import { fetchInventoryItems, fetchCustomers } from '@/lib/api'
import { useRpc } from '@/hooks/useRpc'
import { useToast } from '@/hooks/use-toast'
import { Trash2, Plus } from 'lucide-react'

interface CartItem {
  id: string
  barcode: string
  metal_type: string
  mrp: number
}

interface Customer {
  id: string
  full_name: string
  phone: string
}

export default function POSPage() {
  const { appUser, loading } = useAuth()
  const { callRpc } = useRpc()
  const { toast } = useToast()
  const [cart, setCart] = useState<CartItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [searchCustomer, setSearchCustomer] = useState('')
  const [paymentMode, setPaymentMode] = useState('cash')
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (!appUser) return

    const fetchData = async () => {
      try {
        const { data: customersData } = await fetchCustomers(appUser.company_id)
        setCustomers(customersData || [])
      } catch (err) {
        console.error('Error fetching customers:', err)
      }
    }

    fetchData()
  }, [appUser])

  const handleScan = async (barcode: string) => {
    if (!appUser) return

    try {
      const { data: item, error } = await supabase
        .from('inventory_items')
        .select('id, barcode, metal_type, mrp')
        .eq('barcode', barcode)
        .eq('company_id', appUser.company_id)
        .eq('status', 'in_stock')
        .maybeSingle()

      if (error || !item) {
        toast({
          title: 'Error',
          description: 'Item not found or not in stock',
          variant: 'destructive',
        })
        return
      }

      const newItem: CartItem = {
        id: item.id,
        barcode: item.barcode,
        metal_type: item.metal_type,
        mrp: item.mrp || 0,
      }

      setCart([...cart, newItem])
      toast({ title: 'Success', description: `Added ${barcode} to cart` })
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to add item',
        variant: 'destructive',
      })
    }
  }

  const handleCheckout = async () => {
    if (!appUser || cart.length === 0) {
      toast({ title: 'Error', description: 'Cart is empty' })
      return
    }

    if (!selectedCustomer) {
      toast({ title: 'Error', description: 'Please select a customer' })
      return
    }

    setIsProcessing(true)
    try {
      const invoiceData = {
        customer_id: selectedCustomer,
        items: cart.map((item) => ({ item_id: item.id, rate: item.mrp })),
        payment_mode: paymentMode,
      }

      const { data, error } = await callRpc('pos_confirm_sale', {
        p_invoice_json: invoiceData,
        p_user_id: appUser.user_id,
      })

      if (error) throw error

      toast({
        title: 'Success',
        description: `Invoice created: ${data?.invoice_number}`,
      })

      // Reset cart
      setCart([])
      setSelectedCustomer('')
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Checkout failed',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const totalAmount = cart.reduce((sum, item) => sum + item.mrp, 0)

  if (loading || !appUser) {
    return <div className="flex items-center justify-center min-h-[50vh]">Loading POS...</div>
  }

  return (
    <div className="space-y-6">
        {/* Page Title */}
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Point of Sale</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scanner and Cart Area */}
          <div className="lg:col-span-2 space-y-6">
            <Scanner onScan={handleScan} />

            {/* Cart Items */}
            <Card className="p-6">
              <h2 className="font-bold text-lg mb-4">Shopping Cart</h2>

              {cart.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-gray-50/50">
                  <p className="text-gray-500 font-medium">Scan items to start billing</p>
                  <p className="text-xs text-gray-400 mt-1">Use the barcode scanner above</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-3 border rounded bg-white shadow-sm"
                    >
                      <div>
                        <p className="font-medium">{item.barcode}</p>
                        <p className="text-sm text-gray-500 capitalize">{item.metal_type}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-bold">₹{item.mrp.toLocaleString()}</p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setCart(cart.filter((_, i) => i !== idx))
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Checkout Sidebar */}
          <div className="space-y-4">
            {/* Customer Selection */}
            <Card className="p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                 <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                 Customer
              </h3>
              <Input
                placeholder="Search customer..."
                value={searchCustomer}
                onChange={(e) => setSearchCustomer(e.target.value)}
                className="mb-2"
              />
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
              >
                <option value="">Select customer</option>
                {customers
                  .filter((c) =>
                    c.full_name.toLowerCase().includes(searchCustomer.toLowerCase())
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
              </select>
            </Card>

            {/* Payment */}
            <Card className="p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                 <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                 Payment
              </h3>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-white mb-2"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI / QR</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </Card>

            {/* Summary */}
            <Card className="p-4 bg-slate-900 text-white border-slate-900">
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-slate-300 text-sm">
                  <span>Total Items</span>
                  <span className="font-bold text-white">{cart.length}</span>
                </div>
                <div className="border-t border-slate-700 pt-3 mt-2">
                  <div className="flex justify-between font-bold text-xl">
                    <span>Total</span>
                    <span>₹{totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCheckout}
                disabled={isProcessing || cart.length === 0}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold h-12"
              >
                {isProcessing ? 'Processing...' : 'Confirm Sale'}
              </Button>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="w-full" onClick={() => toast({description: "Print functionality pending"})}>
                  Print Last
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setCart([])}
                >
                  Reset
                </Button>
            </div>
          </div>
        </div>
    </div>
  )
}