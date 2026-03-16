"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Ticket, User, Phone, MapPin, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Separator } from '@radix-ui/react-separator'

export default function VoucherClaimPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    code: '', name: '', phone: '', city: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.code || !formData.name || !formData.phone) {
      return toast.error("Please fill in all required fields")
    }

    setLoading(true)
    try {
      // Call the secure RPC function as an anonymous user
      const { data, error } = await supabase.rpc('register_voucher_public', {
        p_code: formData.code.toUpperCase().trim(),
        p_name: formData.name,
        p_phone: formData.phone,
        p_city: formData.city || null
      })

      if (error) throw error

      setSuccess(true)
      toast.success("Voucher Registered Successfully!")
    } catch (err: any) {
      toast.error(err.message || "Failed to register voucher.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-emerald-100 bg-white">
          <CardContent className="p-10 flex flex-col items-center text-center space-y-4">
            <div className="h-20 w-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-black uppercase text-slate-800 tracking-tight">Voucher Activated</h2>
            <p className="text-sm text-slate-500">
              Your voucher <strong>{formData.code.toUpperCase()}</strong> is now securely linked to your profile. Please provide your phone number at the billing counter to redeem it.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md space-y-8">
        
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black uppercase tracking-widest text-[#0078D7]">Biillo</h1>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Gift & Voucher Registration</p>
        </div>

        <Card className="shadow-2xl border-slate-200">
          <CardHeader className="bg-slate-900 text-white rounded-t-xl p-6 text-center">
            <CardTitle className="text-xl font-bold tracking-wide">Unlock Your Benefits</CardTitle>
            <CardDescription className="text-slate-300 text-xs mt-2">
              Register your voucher code to activate it for your next in-store purchase.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div className="space-y-2 relative">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Voucher Code *</Label>
                <div className="relative">
                  <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input 
                    required autoFocus
                    className="h-12 pl-10 text-lg font-black uppercase tracking-[0.2em] border-slate-300 focus-visible:ring-[#0078D7]" 
                    placeholder="ENTER CODE" 
                    value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} 
                  />
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input required className="h-11 pl-10 border-slate-300" placeholder="John Doe" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Mobile Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input required type="tel" className="h-11 pl-10 border-slate-300" placeholder="10-digit mobile number" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">City (Optional)</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input className="h-11 pl-10 border-slate-300" placeholder="Mumbai" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-12 bg-[#0078D7] hover:bg-[#005A9E] text-white font-bold uppercase tracking-widest mt-4">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Activate Voucher"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}