'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { Gem, Eye, EyeOff, Loader2, ArrowRight, Badge } from 'lucide-react'

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

  return (
    <div className="flex min-h-[100dvh] bg-white font-sans">
      
      {/* ========================================================= */}
      {/* LEFT SIDE: FORM AREA (Native App feel on Mobile)          */}
      {/* ========================================================= */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:flex-none lg:w-[45%] xl:w-[40%] overflow-y-auto z-10">
        <div className="mx-auto w-full max-w-sm lg:max-w-[380px] animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-8">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
                <Gem className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">Biillo Jewel</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Welcome back. Please enter your details.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={loading}
                required
                // text-[16px] is critical to prevent iOS Safari auto-zoom
                className="h-12 text-[16px] sm:text-sm border-slate-300 focus-visible:border-slate-900 focus-visible:ring-0 rounded-xl transition-all shadow-sm placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  required
                  className="h-12 text-[16px] sm:text-sm border-slate-300 focus-visible:border-slate-900 focus-visible:ring-0 rounded-xl transition-all pr-12 shadow-sm placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  className="absolute right-0 top-0 h-full px-4 text-slate-400 hover:text-slate-600 focus:outline-none disabled:opacity-50 transition-colors"
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

            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl text-[15px] font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-md transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
          
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-500">
              Secured by Biillo Enterprise Identity
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT SIDE: BRANDING/ART AREA (Hidden on Mobile)          */}
      {/* ========================================================= */}
      <div className="relative hidden w-0 flex-1 lg:block bg-slate-900 overflow-hidden">
        
        {/* Abstract Background Elements */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618403088736-aabbf14a72d4?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-luminosity"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
        <div className="absolute -left-1/4 top-0 w-1/2 h-full bg-gradient-to-r from-slate-900 to-transparent"></div>

        {/* Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-16 xl:p-24 z-10 animate-in fade-in duration-1000 slide-in-from-bottom-8">
          <Badge className="text-[#dda74f] border-[#dda74f]/30 mb-6 bg-slate-900/50 backdrop-blur-md px-3 py-1 text-xs font-semibold tracking-widest uppercase">
            Biillo Jewel OS
          </Badge>
          <h1 className="text-4xl xl:text-5xl font-serif text-white font-medium leading-[1.1] tracking-wide mb-6">
            The operating system <br />
            for modern jewellers.
          </h1>
          <p className="text-lg text-slate-300 max-w-xl font-light leading-relaxed mb-8">
            Manage inventory, orchestrate manufacturing, and streamline retail operations in one unified workspace.
          </p>
          
          {/* Minimalist Tech Specs/Testimonial Area */}
          <div className="flex items-center gap-4 pt-8 border-t border-white/10">
            <div className="flex -space-x-3">
              <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] text-white">B2B</div>
              <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center text-[10px] text-white">POS</div>
              <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-indigo-900 flex items-center justify-center text-[10px] text-white">CRM</div>
            </div>
            <p className="text-sm font-medium text-slate-400">Enterprise Ready</p>
          </div>
        </div>
      </div>
      
    </div>
  )
}