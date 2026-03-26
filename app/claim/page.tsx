"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { 
  Ticket, User, Phone, MapPin, Loader2, CheckCircle2, 
  MessageCircle, X, Send, ChevronDown, HelpCircle 
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Separator } from '@radix-ui/react-separator'

export default function VoucherClaimPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    code: '', name: '', phone: '', city: ''
  })

  // Chatbot & FAQ State
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

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

  const toggleFaq = (index: number) => {
    if (openFaq === index) setOpenFaq(null)
    else setOpenFaq(index)
  }

  // Support WhatsApp Redirection
  const handleWhatsAppRedirect = () => {
    const text = encodeURIComponent("Hi Ossam Jewels, I need some help regarding my gift voucher registration.")
    window.open(`https://wa.me/919322279558?text=${text}`, '_blank')
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#FCFBF9] flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-emerald-100 bg-white rounded-2xl overflow-hidden animate-in zoom-in duration-500">
          <CardContent className="p-10 flex flex-col items-center text-center space-y-5">
            <div className="h-24 w-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-2 shadow-inner border border-emerald-100">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <h2 className="text-3xl font-serif text-slate-800 tracking-tight">Voucher Activated!</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your exclusive gift voucher <strong className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">{formData.code.toUpperCase()}</strong> is now securely linked to your profile. 
            </p>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 w-full mt-4">
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">How to redeem</p>
               <p className="text-sm text-slate-700 font-medium">Simply provide your registered mobile number ({formData.phone}) at the billing counter during your next visit.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FCFBF9] flex flex-col items-center pt-10 pb-28 px-4 font-sans relative overflow-x-hidden selection:bg-rose-100">
      
      <div className="w-full max-w-md space-y-8 z-10">
        
        {/* PREMIUM BRAND HEADER */}
        <div className="text-center space-y-4 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-700">
          <img 
            src="/pavitram-logo.jpg" 
            alt="Pavitram Jewels" 
            className="h-20 w-auto object-contain drop-shadow-sm" 
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', '<h1 class="text-4xl font-serif text-slate-900 tracking-tight mb-2">OSSAM JEWELS</h1>');
            }}
          />
          <div className="space-y-1">
             <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-700/80">Exclusive Privileges</p>
             <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Gift & Voucher Registration</p>
          </div>
        </div>

        {/* MAIN REGISTRATION CARD */}
        <Card className="shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border-slate-200/60 rounded-2xl overflow-hidden bg-white/80 backdrop-blur-xl animate-in zoom-in-95 duration-500 delay-150">
          <CardHeader className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 sm:p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10">
              <Ticket className="w-40 h-40 transform rotate-12" />
            </div>
            <CardTitle className="text-2xl font-serif tracking-wide relative z-10">Unlock Your Benefits</CardTitle>
            <CardDescription className="text-slate-300 text-xs mt-2 relative z-10 leading-relaxed font-medium">
              Register your voucher code below to activate your special discount for your next in-store purchase.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Voucher Code *</Label>
                <div className="relative">
                  <Ticket className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-amber-600/70" />
                  <Input 
                    required autoFocus
                    className="h-14 pl-12 text-lg font-black uppercase tracking-[0.2em] border-slate-200 focus-visible:ring-amber-500/50 bg-slate-50/50 shadow-inner rounded-xl" 
                    placeholder="ENTER CODE" 
                    value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} 
                  />
                </div>
              </div>

              <div className="flex items-center justify-center py-2">
                <div className="h-px bg-slate-100 flex-1"></div>
                <span className="px-4 text-[10px] uppercase font-bold tracking-widest text-slate-300">Your Details</span>
                <div className="h-px bg-slate-100 flex-1"></div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input required className="h-12 pl-11 border-slate-200 focus-visible:ring-slate-400 rounded-xl bg-slate-50/50 font-medium" placeholder="E.g. Anjali Sharma" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mobile Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input required type="tel" className="h-12 pl-11 border-slate-200 focus-visible:ring-slate-400 rounded-xl bg-slate-50/50 font-medium font-mono text-sm" placeholder="10-digit mobile number" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">City (Optional)</Label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input className="h-12 pl-11 border-slate-200 focus-visible:ring-slate-400 rounded-xl bg-slate-50/50 font-medium" placeholder="E.g. Mumbai" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-bold uppercase tracking-widest mt-6 rounded-xl shadow-lg transition-all active:scale-[0.98]">
                {loading ? <Loader2 className="h-5 w-5 animate-spin text-amber-500" /> : "Activate My Voucher"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* CUSTOMER FAQs */}
        <div className="pt-8 space-y-4 animate-in fade-in duration-1000 delay-300">
          <div className="flex items-center justify-center gap-2 mb-6">
             <HelpCircle className="w-4 h-4 text-slate-400" />
             <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Frequently Asked Questions</h3>
          </div>
          
          <div className="space-y-3">
            {[
              { q: "How do I redeem my voucher?", a: "Once activated here, the voucher is linked to your phone number. Simply tell the cashier your mobile number during your next visit to Ossam Jewels, and the discount will be automatically applied." },
              { q: "Is there an expiry date?", a: "Vouchers typically expire 6 months from the date of issue unless specified otherwise on the physical card. Please redeem it before the expiry date to enjoy your benefits." },
              { q: "Can I combine multiple vouchers?", a: "Generally, only one promotional voucher can be used per invoice. Vouchers cannot be exchanged for cash or combined with ongoing festive discounts." }
            ].map((faq, idx) => (
              <div key={idx} className="bg-white border border-slate-200/60 rounded-xl overflow-hidden shadow-sm transition-all">
                <button 
                  onClick={() => toggleFaq(idx)} 
                  className="w-full flex items-center justify-between p-4 text-left focus:outline-none"
                >
                  <span className="font-serif text-slate-800 font-semibold pr-4">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-amber-600 transition-transform duration-300 ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                <div className={`px-4 text-sm text-slate-600 leading-relaxed overflow-hidden transition-all duration-300 ${openFaq === idx ? 'max-h-40 pb-4 opacity-100' : 'max-h-0 opacity-0'}`}>
                  {faq.a}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* =========================================================
          WHATSAPP CLONE CHATBOT (FLOATING WIDGET)
          ========================================================= */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        
        {/* Chat Window */}
        <div className={`mb-4 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-300 origin-bottom-right ${isChatOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
          <div className="bg-[#075E54] p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center border border-white/30">
                 <img src="/pavitram-logo.jpg" alt="Logo" className="w-5 h-5 object-contain rounded-full bg-white" onError={(e) => e.currentTarget.style.display = 'none'} />
               </div>
               <div>
                 <p className="font-bold text-sm leading-tight">Ossam Jewels Support</p>
                 <p className="text-[10px] text-emerald-100 flex items-center gap-1">
                   <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> Online
                 </p>
               </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          
          <div className="h-64 bg-[#E5DDD5] p-4 overflow-y-auto flex flex-col gap-3 relative">
            {/* Background WhatsApp Doodle Pattern Simulation */}
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
            
            <div className="bg-white p-3 rounded-tr-xl rounded-b-xl shadow-sm self-start max-w-[85%] text-sm text-slate-800 relative z-10 border border-slate-100">
              <p>Hi there! 👋</p>
              <p className="mt-1">Welcome to Ossam Jewels. Need help registering your gift voucher?</p>
              <p className="text-[9px] text-slate-400 text-right mt-1 font-mono">Just now</p>
            </div>
            
            <div className="bg-[#DCF8C6] p-3 rounded-tl-xl rounded-b-xl shadow-sm self-end max-w-[85%] text-sm text-slate-800 relative z-10 border border-[#bce89f]">
              <p>Yes, I am having some trouble with the code.</p>
              <p className="text-[9px] text-slate-500 text-right mt-1 font-mono flex justify-end items-center gap-1">Just now <CheckCircle2 className="w-3 h-3 text-blue-500"/></p>
            </div>

            <div className="bg-white p-3 rounded-tr-xl rounded-b-xl shadow-sm self-start max-w-[85%] text-sm text-slate-800 relative z-10 border border-slate-100">
              <p>No problem! Click the button below to chat with our executive directly on WhatsApp.</p>
              <p className="text-[9px] text-slate-400 text-right mt-1 font-mono">Just now</p>
            </div>
          </div>
          
          <div className="p-3 bg-white border-t border-slate-100">
            <Button onClick={handleWhatsAppRedirect} className="w-full h-10 bg-[#25D366] hover:bg-[#1DA851] text-white font-bold rounded-xl shadow-sm flex items-center justify-center gap-2">
               <Send className="w-4 h-4" /> Start WhatsApp Chat
            </Button>
          </div>
        </div>

        {/* Floating Toggle Button */}
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)} 
          className="bg-[#25D366] text-white p-4 rounded-full shadow-[0_8px_30px_rgb(37,211,102,0.4)] hover:scale-105 hover:shadow-[0_8px_30px_rgb(37,211,102,0.6)] transition-all duration-300 flex items-center justify-center group"
          title="Chat with us on WhatsApp"
        >
           {isChatOpen ? <X size={28} className="animate-in spin-in-180 duration-300" /> : <MessageCircle size={28} className="group-hover:animate-pulse" />}
        </button>
      </div>

    </div>
  )
}