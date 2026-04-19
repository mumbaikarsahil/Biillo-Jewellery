'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard')
      } else {
        setIsCheckingSession(false)
      }
    }
    checkAuth()
  }, [router])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast.error('Please enter both email and password')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      toast.success('Logged in successfully')
      router.push('/dashboard')
      router.refresh() 
      
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed')
      setLoading(false) 
    }
  }

  if (isCheckingSession) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-slate-900 opacity-80" />
      </div>
    )
  }

  const handleForgotPassword = () => {
    toast.info('Please contact the system admin or the main office manager to reset your credentials.')
  }

  if (isCheckingSession) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-slate-900 opacity-80" />
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] w-full bg-white font-sans overflow-hidden">
      
      {/* --- INJECTED CSS FOR CONNECTED DESIGN & AURORA WAVES --- */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dynamicGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes liquidWave {
          0% { transform: scale(1) translate(0, 0); opacity: 0.5; }
          33% { transform: scale(1.1) translate(30px, -50px); opacity: 0.7; }
          66% { transform: scale(0.9) translate(-20px, 20px); opacity: 0.6; }
          100% { transform: scale(1) translate(0, 0); opacity: 0.5; }
        }
        @keyframes diagonalLight {
          0% { transform: rotate(35deg) translate(-100%); opacity: 0.4; }
          50% { opacity: 0.6; }
          100% { transform: rotate(35deg) translate(100%); opacity: 0.4; }
        }
        .bg-connected {
          background: linear-gradient(-45deg, #f0f9ff, #cffafe, #ecfdf5, #ffffff, #f0f9ff);
          background-size: 400% 400%;
          animation: dynamicGradient 15s ease infinite;
        }
        .animate-liquid {
          animation: liquidWave 10s ease-in-out infinite;
        }
        .animate-diagonal-light {
          animation: diagonalLight 12s ease infinite;
        }
        .glass-overlay {
          background: rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
      `}} />

      {/* ========================================================= */}
      {/* LEFT SIDE: ART & BRANDING (Split-screen)                  */}
      {/* ========================================================= */}
      <div className="hidden lg:flex flex-col relative w-1/2 xl:w-[55%] bg-connected border-r border-slate-200 overflow-hidden">
        
        {/* Animated Background Elements (Connecting the space) */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-200/50 blur-[120px] animate-liquid pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-100/60 blur-[120px] animate-liquid pointer-events-none" />

        {/* Diagonal Light Rays */}
        <div className="absolute -inset-[100%] flex gap-8 opacity-40 animate-diagonal-light rotate-[35deg] pointer-events-none z-0">
          <div className="w-32 h-[300%] bg-gradient-to-r from-transparent via-white to-transparent blur-xl" />
          <div className="w-64 h-[300%] bg-gradient-to-r from-transparent via-white to-transparent blur-2xl" />
          <div className="w-24 h-[300%] bg-gradient-to-r from-transparent via-cyan-100 to-transparent blur-xl" />
        </div>

        {/* Frosted Glass Layer over the animations */}
        <div className="absolute inset-0 glass-overlay z-0"></div>

        {/* Top Left Logo - UPDATED WITH WHITE BACKGROUND PILL */}
        <div className="absolute top-0 left-0 p-8 xl:p-12 z-30">
          <div className="bg-white/90 backdrop-blur-md shadow-sm border border-white/20 px-5 py-2.5 rounded-2xl flex items-center justify-center">
            <img 
              src="/blogo.png" 
              alt="Brand Logo" 
              className="h-10 md:h-12 w-auto object-contain"
            />
          </div>
        </div>

        {/* Model Image - Dynamically scaling so it doesn't push text off screen */}
        <div className="relative flex-1 flex items-end justify-center pt-12 z-10 w-full min-h-0 overflow-hidden">
          <img 
            src="/model.png" 
            alt="Jewellery Model" 
            className="w-auto h-full max-h-[55vh] object-contain object-bottom z-10 drop-shadow-2xl"
          />
          {/* Subtle Faded Overlay strip at the bottom to hide the image cut-off */}
          <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-b from-transparent to-white z-20"></div>
        </div>

        {/* Bottom Text Area (Solid White Background) - shrink-0 guarantees it stays visible */}
        <div className="relative z-20 px-8 xl:px-12 pb-8 xl:pb-12 w-full bg-white pt-6 shrink-0">
          <div className="mb-5 flex items-center gap-2 bg-[#064e3b]/10 text-[#064e3b] px-3 py-1 rounded-full text-xs font-semibold tracking-widest uppercase w-fit">
            Biillo Jewel OS
          </div>
          <h1 className="text-4xl xl:text-5xl font-semibold tracking-tight text-[#064e3b] mb-5 leading-[1.15]">
            The operating system <br />
            for modern jewellers.
          </h1>
          
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-[15px] font-medium text-[#064e3b]/80">
            <span className="flex items-center gap-2">
              <span className="text-[#064e3b]/40 font-light text-lg">+</span> B2B Vault
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[#064e3b]/40 font-light text-lg">+</span> Omnichannel POS
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[#064e3b]/40 font-light text-lg">+</span> Smart CRM
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT SIDE: FORM AREA (Pristine SaaS feel)                */}
      {/* ========================================================= */}
      <div className="flex flex-col justify-center flex-1 w-full lg:w-1/2 xl:w-[45%] px-6 sm:px-12 lg:px-16 xl:px-24 bg-white relative z-10 overflow-y-auto shadow-[-20px_0_40px_rgba(0,0,0,0.02)]">
        <div className="mx-auto w-full max-w-[380px] animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Mobile Logo (Only visible on small screens) */}
          <div className="lg:hidden flex items-center justify-center mb-10">
            <img 
              src="/blogo.png" 
              alt="Brand Logo" 
              className="h-12 w-auto object-contain"
            />
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl mb-2">
              Welcome back
            </h2>
            <p className="text-[15px] text-slate-500">
              Enter your credentials to access your workspace.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth}>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-slate-900">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  disabled={loading}
                  required
                  // text-[16px] is critical to prevent iOS Safari auto-zoom
                  className="h-11 text-[16px] sm:text-sm bg-white border-slate-200 focus-visible:border-slate-900 focus-visible:ring-1 focus-visible:ring-slate-900 rounded-lg shadow-sm transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-semibold text-slate-900">
                    Password
                  </Label>
                  {/* --- UPDATED: FORGOT PASSWORD BUTTON --- */}
                  <button 
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors outline-none focus-visible:underline"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                    required
                    className="h-11 text-[16px] sm:text-sm bg-white border-slate-200 focus-visible:border-slate-900 focus-visible:ring-1 focus-visible:ring-slate-900 rounded-lg shadow-sm transition-all pr-12 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-700 focus:outline-none disabled:opacity-50 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2 space-y-5">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-lg text-[15px] font-medium bg-slate-900 hover:bg-slate-800 text-white transition-all active:scale-[0.98] shadow-md"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
                
                {/* Minimalist Security Badge */}
                <div className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-50/50 border border-slate-100">
                  <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0" />
                  <p className="text-[11px] font-medium text-slate-500">
                    Secure enterprise environment. All activity is logged.
                  </p>
                </div>
              </div>
            </div>
          </form>
          
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 font-medium">
              By continuing, you agree to our <a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Privacy Policy</a> and <a href="#" className="text-slate-600 hover:text-slate-900 transition-colors">Terms of Service</a>.
            </p>
          </div>
        </div>
      </div>
      
    </div>
  )
}