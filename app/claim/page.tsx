"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { 
  Ticket, User, Phone, MapPin, Loader2, CheckCircle2, 
  MessageCircle, X, Send, ChevronDown, HelpCircle, Calendar, Heart, ArrowRight, Edit3, Sparkles, PhoneCall
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const BRANCHES = [
  "Andheri", "Borivali", "Vashi", "Virar", "Ghatkopar", "Breach Candy", 
  "Thane", "Kurla", "Parel", "Kamothe", "Dombivali", "Badlapur", "Chakan", 
  "New Sangvi", "Chhatrapati Sambhajinagar", "Uran", "New Sangvi(Pune)", "Chakan (Pune)", "Ch. Sambhajinagar (Aurangabad)"
];

const QUICK_QUESTIONS = [
  { id: "charges", short: "Extra Charges?", q: "Are there any extra or hidden charges?" },
  { id: "minimum", short: "Minimum Purchase?", q: "Is there a minimum purchase amount?" },
  { id: "timing", short: "Store Timings?", q: "What are your store timings?" },
  { id: "gold", short: "Plain Gold?", q: "Can I buy plain gold with this?" },
  { id: "lab", short: "Lab Diamonds?", q: "Are these lab-grown diamonds?" }
];

const BOT_ANSWERS: Record<string, string> = {
  "minimum": "There is no restriction, you can buy whatever you love to buy. Our range starts from Rs 8,500/- only.",
  "timing": "Our store timings are 11:00am – 8:30pm. Yes, we are definitely open on Sundays.",
  "gold": "Sorry, we don’t sell plain gold. We have 14 carat & 18 carats of gold available in our diamond jewellery.",
  "lab": "No. We do not deal in Lab grown diamonds. We deal only into natural, Real diamond jewellery."
};

// --- Custom Mobile-Friendly Date Picker ---
const NativeDatePicker = ({ value, onChange, label, icon: Icon, type = 'dob', required = false }: any) => {
  const [d, setD] = useState(value ? value.split('-')[2] : '');
  const [m, setM] = useState(value ? value.split('-')[1] : '');
  const [y, setY] = useState(value ? value.split('-')[0] : '');

  useEffect(() => {
    if (d && m && y) onChange(`${y}-${m}-${d}`);
    else onChange('');
  }, [d, m, y]);

  const currentYear = new Date().getFullYear();
  const years = type === 'dob' 
    ? Array.from({length: 100}, (_, i) => currentYear - 16 - i) 
    : Array.from({length: 70}, (_, i) => currentYear - i);

  return (
    <div className="space-y-1.5 w-full">
      <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label} {required ? '*' : <span className="font-normal text-slate-400">(Opt)</span>}
      </Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <select required={required} value={d} onChange={(e) => setD(e.target.value)} className="w-full h-11 pl-3 pr-6 appearance-none border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 rounded-xl bg-white/80 font-medium text-xs text-slate-700 transition-all shadow-sm">
            <option value="" disabled>Day</option>
            {Array.from({length: 31}, (_, i) => String(i + 1).padStart(2, '0')).map(day => <option key={day} value={day}>{day}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative flex-1">
          <select required={required} value={m} onChange={(e) => setM(e.target.value)} className="w-full h-11 pl-3 pr-6 appearance-none border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 rounded-xl bg-white/80 font-medium text-xs text-slate-700 transition-all shadow-sm">
            <option value="" disabled>Mth</option>
            {Array.from({length: 12}, (_, i) => String(i + 1).padStart(2, '0')).map(month => <option key={month} value={month}>{month}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative flex-[1.2]">
          <select required={required} value={y} onChange={(e) => setY(e.target.value)} className="w-full h-11 pl-3 pr-6 appearance-none border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 rounded-xl bg-white/80 font-medium text-xs text-slate-700 transition-all shadow-sm">
            <option value="" disabled>Year</option>
            {years.map(year => <option key={year} value={String(year)}>{year}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
        </div>
      </div>
    </div>
  )
}

export default function VoucherClaimPage() {
  const [step, setStep] = useState(0) 
  const [isVerifying, setIsVerifying] = useState(false) 
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    code: '', name: '', phone: '', nearestBranch: '', dob: '', anniversary: ''
  })
  
  // ✨ FIX: State to hold the voucher expiry date
  const [voucherExpiry, setVoucherExpiry] = useState<string | null>(null)

  // Chatbot & FAQ State
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<any[]>([
    { sender: 'bot', text: "Hi there! 👋\nWelcome to Pavitram Diamond Jewellery. How can I help you today?" }
  ])
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, isChatOpen, chatInput])

  const filteredQuestions = chatInput.trim() 
    ? QUICK_QUESTIONS.filter(q => 
        q.q.toLowerCase().includes(chatInput.toLowerCase()) || 
        q.short.toLowerCase().includes(chatInput.toLowerCase())
      )
    : QUICK_QUESTIONS;

  // --- REAL DATABASE VALIDATION STEP ---
  const handleNextStep = async () => {
    const codeToVerify = formData.code.toUpperCase().trim();
    if (!codeToVerify) {
      return toast.error("Please enter a voucher code first.")
    }
    
    setIsVerifying(true)
    
    try {
      const minDelay = new Promise(resolve => setTimeout(resolve, 1200));
      
      const dbFetch = supabase
        .from('vouchers')
        .select('status, expiry_date')
        .eq('code', codeToVerify)
        .maybeSingle();

      const [_, { data, error }] = await Promise.all([minDelay, dbFetch]);

      if (error) throw error;
      if (!data) throw new Error("Voucher code not found. Please check your spelling.");
      
      // Strict Status Validations
      if (data.status === 'redeemed') throw new Error("This voucher has already been redeemed at the store.");
      if (data.status === 'voided') throw new Error("This voucher code has been voided by management.");
      if (data.status === 'registered') throw new Error("This voucher is already registered to a customer.");
      if (data.status === 'expired' || (data.expiry_date && new Date(data.expiry_date) < new Date())) {
        throw new Error("This voucher has expired.");
      }
      if (data.status !== 'distributed' && data.status !== 'in_stock') {
        throw new Error("Invalid voucher code, Please contact the support");
      }

      // ✨ FIX: Store the expiry date for the success screen
      if (data.expiry_date) {
        setVoucherExpiry(data.expiry_date);
      }

      setStep(1) 
    } catch (err: any) {
      toast.error(err.message || "Invalid voucher code.", { duration: 4000 });
      setIsVerifying(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.phone || !formData.nearestBranch || !formData.dob) {
      return toast.error("Please fill in your Name, Phone, Branch, and Date of Birth.")
    }

    // ✨ FIX: Ensure exactly 10 digits
    if (formData.phone.length !== 10) {
      return toast.error("Please enter a valid 10-digit mobile number.");
    }

    setLoading(true)
    try {
      const cleanCode = formData.code.toUpperCase().trim();
      const { data, error } = await supabase.rpc('register_voucher_public', {
        p_code: cleanCode,
        p_name: formData.name,
        p_phone: formData.phone,
        p_branch: formData.nearestBranch,
        p_dob: formData.dob, 
        p_anniversary: formData.anniversary || null
      })

      if (error) throw error

      // ✨ FIX: Fetch the freshly updated expiry date from the database
      // This immediately overrides the old "Nov 4" date fetched in Step 0
      const { data: updatedVoucher } = await supabase
        .from('vouchers')
        .select('expiry_date')
        .eq('code', cleanCode)
        .maybeSingle();

      if (updatedVoucher?.expiry_date) {
        setVoucherExpiry(updatedVoucher.expiry_date);
      } else {
        // Fallback calculation just in case the DB fetch drops
        const fallbackDate = new Date();
        fallbackDate.setMonth(fallbackDate.getMonth() + 1);
        setVoucherExpiry(fallbackDate.toISOString());
      }

      setStep(2) 
    } catch (err: any) {
      toast.error(err.message || "Failed to register voucher.")
    } finally {
      setLoading(false)
    }
  }

  const toggleFaq = (index: number) => setOpenFaq(openFaq === index ? null : index)

  const handleQuickQuestion = (id: string, qText: string) => {
    setChatMessages(prev => [...prev, { sender: 'user', text: qText }]);
    setTimeout(() => {
      setChatMessages(prev => [...prev, { sender: 'bot', text: BOT_ANSWERS[id] }]);
    }, 600);
  }

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const lowerInput = chatInput.toLowerCase();
    
    const match = QUICK_QUESTIONS.find(q => 
      q.q.toLowerCase().includes(lowerInput) || 
      lowerInput.includes(q.short.toLowerCase().replace('?', ''))
    );

    const isPleasantry = lowerInput.match(/\b(ok|okay|thank you|thanks|thx|great|awesome|perfect|good)\b/);

    setChatMessages(prev => [...prev, { sender: 'user', text: chatInput }]);
    setChatInput("");

    setTimeout(() => {
      if (isPleasantry) {
        setChatMessages(prev => [...prev, { sender: 'bot', text: "You're very welcome! Let me know if you need anything else. 😊" }]);
      } else if (match) {
        setChatMessages(prev => [...prev, { sender: 'bot', text: BOT_ANSWERS[match.id] }]);
      } else {
        setChatMessages(prev => [...prev, { 
          sender: 'bot', 
          text: "I'm still learning! For this specific query, please connect with our human support team:",
          isFallback: true 
        }]);
      }
    }, 600);
  }

  const handleWhatsAppRedirect = () => {
    const text = encodeURIComponent("Hi Ossam Jewels, I need some help regarding my gift voucher registration.")
    window.open(`https://wa.me/918779628339?text=${text}`, '_blank') 
  }

  const handleCallRedirect = () => {
    window.open(`tel:+918779628339`, '_self') 
  }

  return (
    <div className="min-h-screen flex flex-col items-center pt-8 pb-32 px-4 font-sans relative overflow-x-hidden selection:bg-amber-200">
      
      <div className="fixed inset-0 z-[-1] bg-gradient-to-br from-rose-50 via-slate-50 to-amber-50" />
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-rose-200/40 blur-[100px] z-[-1]" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-amber-200/30 blur-[100px] z-[-1]" />
      
      <div className="w-full max-w-[460px] space-y-8 z-10 flex flex-col items-center">
        
        <div className="text-center space-y-3 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-700">
          <img 
            src="/pavitram-logo.png" 
            alt="Pavitram Jewels" 
            className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm mix-blend-multiply" 
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', '<h1 class="text-3xl font-serif text-slate-900 tracking-tight mb-2">OSSAM JEWELS</h1>');
            }}
          />
          <div className="space-y-0.5">
             <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-700/80">Voucher Redeemption</p>
          </div>
        </div>

        <Card className="w-full bg-white/70 backdrop-blur-2xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl overflow-hidden relative transition-all duration-500 ease-in-out">
          <CardContent className="p-6 sm:p-10 min-h-[300px] flex flex-col justify-center">
            
            {step === 0 && (
              <div className="animate-in slide-in-from-bottom-8 fade-in duration-700 space-y-6 w-full">
                {!isVerifying ? (
                  <>
                    <div className="space-y-2 text-center">
                      <div className="mx-auto w-12 h-12 bg-amber-100/50 text-amber-600 rounded-full flex items-center justify-center mb-4 border border-amber-200/50">
                        <Ticket className="w-6 h-6" />
                      </div>
                      <h2 className="text-2xl font-serif text-slate-800 tracking-tight leading-tight">
                        Let's get started. <br/>What's your voucher code?
                      </h2>
                    </div>
                    
                    <div className="space-y-4 pt-4">
                      <div className="relative group">
                        <input 
                          autoFocus
                          type="text"
                          inputMode="text"
                          autoCapitalize="characters"
                          autoComplete="off"
                          autoCorrect="off"
                          className="w-full h-16 text-center text-2xl font-black uppercase tracking-[0.2em] border-b-2 border-slate-200 focus:border-amber-500 bg-transparent focus:outline-none transition-colors text-slate-800 placeholder:text-slate-300" 
                          placeholder="ENTER CODE" 
                          value={formData.code} 
                          onChange={(e) => setFormData({...formData, code: e.target.value})} 
                          onKeyDown={(e) => e.key === 'Enter' && handleNextStep()}
                        />
                      </div>
                      
                      <Button 
                        onClick={handleNextStep}
                        className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-2xl shadow-lg transition-all active:scale-[0.98] group mt-6"
                      >
                        Continue <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="relative">
                      <div className="absolute inset-0 bg-amber-400 rounded-full blur-xl animate-pulse opacity-40"></div>
                      <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center shadow-xl relative z-10 border border-slate-100">
                        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                      </div>
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-serif text-slate-800 tracking-tight animate-pulse">Verifying Code...</h3>
                      <p className="text-xs text-slate-500 font-mono uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-md inline-block">
                        {formData.code}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="animate-in slide-in-from-right-8 fade-in duration-500 space-y-6 w-full">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-serif text-slate-800 tracking-tight">
                    Please <br/> fill your details
                  </h2>
                  <button 
  onClick={() => {
    setStep(0);
    setIsVerifying(false); // ✨ FIX: Stops the infinite loading loop
    setFormData({ ...formData, code: '' }); // ✨ FIX: Clears the input so they can type a new one
  }} 
  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors border border-slate-200/60 shadow-sm"
>
  <Edit3 className="w-3 h-3" /> {formData.code}
</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name *</Label>
                    <div className="relative flex items-center">
                      <User className="absolute left-4 h-4 w-4 text-slate-400 pointer-events-none" />
                      <Input required autoFocus className="h-12 pl-11 border-slate-200/60 focus-visible:ring-amber-500/30 rounded-2xl bg-white/80 font-medium text-sm shadow-sm transition-all" placeholder="E.g. Anjali Sharma" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                    </div>
                  </div>

                  {/* ✨ FIX: Restricted Phone Input with static +91 */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Mobile Number *</Label>
                    <div className="relative flex items-center">
                      <div className="absolute left-4 flex items-center gap-1.5 pointer-events-none">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-600 border-r border-slate-300 pr-2">+91</span>
                      </div>
                      <Input 
                        required 
                        type="tel" 
                        inputMode="numeric" 
                        maxLength={10}
                        className="h-12 pl-[84px] border-slate-200/60 focus-visible:ring-amber-500/30 rounded-2xl bg-white/80 font-medium font-mono text-sm shadow-sm transition-all" 
                        placeholder="10-digit number" 
                        value={formData.phone} 
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setFormData({...formData, phone: digits});
                        }} 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nearest Branch *</Label>
                    <Select value={formData.nearestBranch} onValueChange={(val) => setFormData({...formData, nearestBranch: val})} required>
                      <SelectTrigger className="w-full h-12 pl-4 pr-3 border-slate-200/60 focus:ring-amber-500/30 rounded-2xl bg-white/80 font-medium text-sm text-slate-700 shadow-sm transition-all">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-slate-400" />
                          <SelectValue placeholder="Select showroom..." />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="max-h-[250px] rounded-2xl border-slate-200/60 bg-white/95 backdrop-blur-xl">
                        {BRANCHES.map(branch => (
                          <SelectItem key={branch} value={branch} className="text-sm font-medium py-2.5 cursor-pointer">{branch}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="pt-2 pb-1 flex flex-col gap-4">
                    <NativeDatePicker required={true} value={formData.dob} onChange={(v: string) => setFormData({...formData, dob: v})} label="Date of Birth" icon={Calendar} type="dob" />
                    <NativeDatePicker value={formData.anniversary} onChange={(v: string) => setFormData({...formData, anniversary: v})} label="Anniversary" icon={Heart} type="anniversary" />
                  </div>

                  <Button type="submit" disabled={loading || formData.phone.length !== 10} className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-2xl mt-4 shadow-xl transition-all active:scale-[0.98]">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin text-amber-500" /> : "Activate Voucher"}
                  </Button>
                </form>
              </div>
            )}

            {step === 2 && (
              <div className="animate-in zoom-in-90 slide-in-from-bottom-4 duration-1000 flex flex-col items-center text-center w-full pb-2">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-emerald-400 rounded-full blur-2xl animate-pulse opacity-40"></div>
                  <div className="h-24 w-24 bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.3)] border border-emerald-200 relative z-10 animate-in zoom-in duration-500 delay-150">
                    <CheckCircle2 className="h-12 w-12" />
                  </div>
                </div>
                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                  <h2 className="text-4xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-emerald-800 to-emerald-500 tracking-tight">Activated!</h2>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-[280px] mx-auto mt-2">
                    Your exclusive voucher <strong className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 shadow-sm">{formData.code.toUpperCase()}</strong> is registered sucessfully
                  </p>
                </div>
                <div className="bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-white/50 w-full mt-8 text-left shadow-lg animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                     <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> How to redeem
                   </p>
                   <p className="text-sm text-slate-700 font-medium leading-snug">
                     Visit our <b className="text-slate-900">nearest branch</b> and simply provide your Voucher Code with a valid ID proof at the billing counter.
                     
                     {/* ✨ FIX: Show the dynamic expiry date */}
                     {voucherExpiry ? (
                        <span className="block mt-1.5 text-rose-600">Valid until <b>{new Date(voucherExpiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</b>.</span>
                     ) : (
                        <span className="block mt-1.5 text-rose-600">Validity of voucher is 1 month from the date of activation.</span>
                     )}
                   </p>
                </div>
              </div>
            )}

          </CardContent>
        </Card>

        {step !== 2 && (
          <div className="w-full pt-4 space-y-3 animate-in fade-in duration-1000 delay-300">
            <div className="flex items-center justify-center gap-2 mb-4">
               <HelpCircle className="w-4 h-4 text-slate-400" />
               <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Frequently Asked Questions</h3>
            </div>
            
            <div className="space-y-2">
              {[
                { q: "What products are covered?", a: "The voucher is applicable on all our jewellery which is hallmarked gold studded with real diamond jewellery. We do not sell plain gold." },
                { q: "Are there any hidden conditions or extra charges?", a: "There are no hidden conditions. You only pay handling charges & 3% GST on your total bill amount." },
                { q: "Is there a minimum purchase requirement?", a: "There is no restriction, you can buy whatever you love. Our real diamond jewellery range starts from Rs 8,500/- only." },
                { q: "Can I combine it with other offers or get cash?", a: "No, this voucher is not valid with other offers or discounts, and it is not redeemable for cash. It must be used in a single transaction." },
              ].map((faq, idx) => (
                <div key={idx} className="bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all">
                  <button 
                    onClick={() => toggleFaq(idx)} 
                    className="w-full flex items-center justify-between p-4 text-left focus:outline-none active:bg-white/80 touch-manipulation"
                  >
                    <span className="font-serif text-slate-800 font-semibold pr-4 text-sm leading-snug">{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-amber-600 transition-transform duration-300 shrink-0 ${openFaq === idx ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`px-4 text-xs text-slate-600 leading-relaxed overflow-hidden transition-all duration-300 ${openFaq === idx ? 'max-h-40 pb-4 opacity-100' : 'max-h-0 opacity-0'}`}>
                    {faq.a}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          PREDICTIVE CHATBOT WIDGET
          ========================================================= */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end">
        
        <div className={`mb-4 w-[320px] sm:w-[350px] max-w-[calc(100vw-2rem)] bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white overflow-hidden transition-all duration-300 origin-bottom-right flex flex-col ${isChatOpen ? 'scale-100 opacity-100 h-[500px]' : 'scale-0 opacity-0 h-0 pointer-events-none'}`}>
          
          <div className="bg-slate-900 p-3 sm:p-4 text-white flex items-center justify-between shrink-0 shadow-md relative z-20">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
                 <img src="/pavitram-logo.jpg" alt="Logo" className="w-5 h-5 object-contain rounded-full bg-white" onError={(e) => e.currentTarget.style.display = 'none'} />
               </div>
               <div>
                 <p className="font-bold text-sm leading-tight tracking-wide">Pavitram help bot</p>
                 <p className="text-[10px] text-amber-300/80 flex items-center gap-1 font-medium tracking-widest uppercase mt-0.5">
                   <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span> Online
                 </p>
               </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-white/60 hover:text-white p-1 transition-colors"><X className="w-5 h-5" /></button>
          </div>
          
          <div className="flex-1 bg-slate-50/50 p-4 overflow-y-auto flex flex-col gap-3 relative custom-scrollbar">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`p-3 shadow-sm max-w-[85%] text-xs sm:text-sm relative z-10 ${msg.sender === 'bot' ? 'bg-white rounded-2xl rounded-tl-sm self-start border border-slate-100 text-slate-800' : 'bg-slate-900 rounded-2xl rounded-tr-sm self-end text-white'}`}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                
                {/* Fallback Action Buttons */}
                {msg.isFallback && (
                  <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-slate-100">
                    <Button onClick={handleCallRedirect} size="sm" className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10px] uppercase shadow-none border border-slate-200 h-8 rounded-lg">
                      <PhoneCall className="w-3 h-3 mr-1.5" /> Call Us
                    </Button>
                    <Button onClick={handleWhatsAppRedirect} size="sm" className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#1DA851] font-bold text-[10px] uppercase shadow-none border border-[#25D366]/30 h-8 rounded-lg">
                      <MessageCircle className="w-3 h-3 mr-1.5" /> WhatsApp
                    </Button>
                  </div>
                )}

                <p className={`text-[9px] text-right mt-1.5 font-mono flex justify-end items-center gap-1 ${msg.sender === 'bot' ? 'text-slate-400' : 'text-slate-400'}`}>
                  Just now {msg.sender === 'user' && <CheckCircle2 className="w-3 h-3 text-amber-400"/>}
                </p>
              </div>
            ))}
            
            {!chatInput.trim() && chatMessages.length < 3 && (
              <div className="mt-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2 text-center">Suggested Topics</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {QUICK_QUESTIONS.map(qq => (
                    <button 
                      key={qq.id}
                      onClick={() => handleQuickQuestion(qq.id, qq.q)}
                      className="bg-white border border-slate-200 text-slate-600 text-[11px] font-semibold px-3 py-2 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm text-left flex-1 min-w-[120px] active:scale-95"
                    >
                      {qq.short}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          <div className="bg-white/80 backdrop-blur-md p-2 pt-0 shrink-0 flex flex-col">
            
            {chatInput.trim() && filteredQuestions.length > 0 && (
              <div className="flex flex-col gap-1 mb-2 max-h-[100px] overflow-y-auto custom-scrollbar px-1">
                {filteredQuestions.map(qq => (
                   <button 
                     key={qq.id} 
                     onClick={() => { setChatInput(''); handleQuickQuestion(qq.id, qq.q); }} 
                     className="text-left text-[11px] bg-slate-50 hover:bg-slate-100 text-slate-700 p-2.5 rounded-xl border border-slate-200/60 transition-colors font-medium"
                   >
                     {qq.q}
                   </button>
                ))}
              </div>
            )}

            <form onSubmit={handleChatSubmit} className="flex items-center gap-2 p-1 border-t border-slate-100 pt-2">
              <Input 
                value={chatInput} 
                onChange={e => setChatInput(e.target.value)} 
                placeholder="Ask anything..." 
                className="h-10 text-xs sm:text-sm bg-slate-100/50 border-slate-200 focus-visible:ring-slate-300 rounded-xl" 
              />
              <Button type="submit" size="icon" className="h-10 w-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shrink-0 shadow-sm transition-all active:scale-95">
                <Send className="h-4 w-4 ml-0.5" />
              </Button>
            </form>
            
            {/* Brand Watermark */}
            <div className="text-center pt-1.5 pb-0.5">
               <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em]">⚡ Powered by Biillo</p>
            </div>
          </div>
        </div>

        <div className="relative flex items-center">
          {!isChatOpen && (
            <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 animate-bounce flex items-center z-50">
              <div className="bg-white text-slate-800 text-[11px] font-bold px-3.5 py-2 rounded-full shadow-lg border border-slate-100 whitespace-nowrap">
                Need Support? 👋
              </div>
              <div className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[6px] border-l-white -ml-[1px]"></div>
            </div>
          )}
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)} 
            className="bg-slate-900 text-white p-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:scale-105 hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-300 flex items-center justify-center group border border-slate-700 relative z-50"
          >
             {isChatOpen ? <X size={24} className="animate-in spin-in-180 duration-300 text-amber-50" /> : <MessageCircle size={24} className="group-hover:animate-pulse text-amber-50" />}
          </button>
        </div>
      </div>

    </div>
  )
}