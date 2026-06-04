"use client"

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog"
import { 
  Loader2, Clock, CheckCircle2, PlayCircle, StopCircle, Edit3, MessageCircle, Settings2, CalendarClock
} from 'lucide-react'

export default function CampaignManagerPage() {
  const [sequences, setSequences] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Modal states for editing sequence
  const [editingSeq, setEditingSeq] = useState<any | null>(null)
  const [newInterval, setNewInterval] = useState<string>('')
  const [newStep, setNewStep] = useState<string>('2')
  const [newNextSendAt, setNewNextSendAt] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState(false)

  const fetchSequences = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('voucher_message_sequences')
        .select(`
          *,
          customers ( full_name, phone )
        `)
        .order('next_send_at', { ascending: true })

      if (error) throw error
      setSequences(data || [])
    } catch (err: any) {
      toast.error('Failed to load sequences: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSequences()
  }, [])

  // ── Stop Sequence Action ──────────────────────────────────────────────
  const handleStopSequence = async (id: string) => {
    if (!confirm("Are you sure you want to completely stop this drip campaign?")) return;

    try {
      const { error } = await supabase
        .from('voucher_message_sequences')
        .update({ status: 'completed' })
        .eq('id', id)

      if (error) throw error
      
      toast.success("Sequence successfully stopped.")
      setSequences(prev => prev.map(s => s.id === id ? { ...s, status: 'completed' } : s))
    } catch (err: any) {
      toast.error("Failed to stop sequence: " + err.message)
    }
  }

  // ── Resume Sequence Action (Optional) ─────────────────────────────────
  const handleResumeSequence = async (id: string) => {
    try {
      const { error } = await supabase
        .from('voucher_message_sequences')
        .update({ status: 'active' })
        .eq('id', id)

      if (error) throw error
      
      toast.success("Sequence is active again.")
      setSequences(prev => prev.map(s => s.id === id ? { ...s, status: 'active' } : s))
    } catch (err: any) {
      toast.error("Failed to resume sequence: " + err.message)
    }
  }

  // ── Update Sequence Configuration Action ──────────────────────────────
  const handleUpdateSequence = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSeq) return

    const hours = parseInt(newInterval)
    const step = parseInt(newStep)

    if (isNaN(hours) || hours <= 0) return toast.error("Please enter a valid number of hours.")
    if (isNaN(step) || step < 2 || step > 7) return toast.error("Step must be between 2 and 7.")
    if (!newNextSendAt) return toast.error("Please select a valid next send date.")

    setIsUpdating(true)
    try {
      // Convert local datetime-local string back to proper UTC ISO string for Supabase
      const nextSendAtISO = new Date(newNextSendAt).toISOString()

      const { error } = await supabase
        .from('voucher_message_sequences')
        .update({ 
          interval_hours: hours,
          current_step: step,
          next_send_at: nextSendAtISO
        })
        .eq('id', editingSeq.id)

      if (error) throw error

      toast.success("Sequence configuration updated!")
      
      // Update local state to reflect changes instantly
      setSequences(prev => prev.map(s => s.id === editingSeq.id ? { 
        ...s, 
        interval_hours: hours,
        current_step: step,
        next_send_at: nextSendAtISO
      } : s))
      
      setEditingSeq(null)
    } catch (err: any) {
      toast.error("Failed to update sequence: " + err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  // Helper to open modal and parse data into form inputs
  const openEditModal = (seq: any) => {
    setEditingSeq(seq)
    setNewInterval(seq.interval_hours.toString())
    setNewStep(seq.current_step.toString())
    
    // Convert UTC ISO to Local time format required by <input type="datetime-local" /> (YYYY-MM-DDThh:mm)
    const d = new Date(seq.next_send_at)
    const tzOffset = d.getTimezoneOffset() * 60000
    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0,16)
    setNewNextSendAt(localISOTime)
  }

  // ── Helper Formatting ─────────────────────────────────────────────────
  const formatStep = (step: number) => {
    if (step >= 7) return "Completed"
    return `Msg ${step - 1} (Step ${step})`
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }).format(new Date(dateString))
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 h-16 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="font-bold text-gray-900 text-lg">Drip Campaigns</h1>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Message Sequence Controller</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSequences} className="shadow-sm">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Clock className="w-4 h-4 mr-2" />}
          Refresh Queue
        </Button>
      </header>

      <main className="p-4 md:p-6 max-w-7xl w-full mx-auto space-y-6">
        <Card className="border-gray-200/60 shadow-sm bg-white overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50/80">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-black tracking-widest text-gray-400 h-10 px-6">Customer / Voucher</TableHead>
                      <TableHead className="text-[10px] uppercase font-black tracking-widest text-gray-400 h-10 text-center">Progress</TableHead>
                      <TableHead className="text-[10px] uppercase font-black tracking-widest text-gray-400 h-10 text-center">Next Send At</TableHead>
                      <TableHead className="text-[10px] uppercase font-black tracking-widest text-gray-400 h-10 text-center">Interval</TableHead>
                      <TableHead className="text-[10px] uppercase font-black tracking-widest text-gray-400 h-10 text-center">Status</TableHead>
                      <TableHead className="text-[10px] uppercase font-black tracking-widest text-gray-400 h-10 text-right pr-6">Controls</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sequences.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-10 text-gray-400 font-medium">No sequences found.</TableCell></TableRow>
                    )}
                    {sequences.map((seq) => (
                      <TableRow key={seq.id} className="hover:bg-gray-50/50 transition-colors">
                        <TableCell className="px-6 py-4">
                          <div className="font-bold text-sm text-gray-900 flex items-center gap-2">
                            {seq.customers?.full_name || "Unknown User"} 
                            <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 text-gray-600">{seq.voucher_code}</span>
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <MessageCircle className="w-3 h-3 text-emerald-500" /> {seq.convo360_user_id}
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-center py-4">
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                            {formatStep(seq.current_step)}
                          </span>
                        </TableCell>

                        <TableCell className="text-center py-4">
                          {seq.status === 'completed' ? (
                            <span className="text-gray-400 text-xs font-medium">---</span>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-bold text-gray-900">{formatDate(seq.next_send_at)}</span>
                              {new Date(seq.next_send_at) < new Date() && (
                                <span className="text-[9px] font-bold uppercase tracking-widest text-rose-500 bg-rose-50 px-1 rounded mt-0.5">Overdue</span>
                              )}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-center py-4">
                          <span className="font-mono text-xs font-bold bg-gray-100 px-2 py-1 rounded text-gray-700">{seq.interval_hours}H</span>
                        </TableCell>

                        <TableCell className="text-center py-4">
                          {seq.status === 'active' ? (
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-emerald-200 shadow-none">
                              <PlayCircle className="w-3 h-3 mr-1" /> Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-500 border-gray-200 shadow-none">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right pr-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {/* NEW: Edit Configuration Button */}
                            <Button size="icon" variant="outline" className="h-8 w-8 text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => openEditModal(seq)}>
                              <Settings2 className="w-3.5 h-3.5" />
                            </Button>

                            {/* Play/Stop Button */}
                            {seq.status === 'active' ? (
                              <Button size="sm" variant="outline" className="h-8 border-rose-200 text-rose-600 hover:bg-rose-50 font-bold uppercase tracking-widest text-[10px]" onClick={() => handleStopSequence(seq.id)}>
                                <StopCircle className="w-3.5 h-3.5 mr-1.5" /> Stop
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="h-8 border-gray-200 text-gray-500 hover:bg-gray-50 font-bold uppercase tracking-widest text-[10px]" onClick={() => handleResumeSequence(seq.id)}>
                                <PlayCircle className="w-3.5 h-3.5 mr-1.5" /> Resume
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* ── Edit Sequence Configuration Modal ── */}
      <Dialog open={!!editingSeq} onOpenChange={(open) => !open && setEditingSeq(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-900">
              <CalendarClock className="w-5 h-5 text-indigo-500" /> Sequence Configuration
            </DialogTitle>
            <DialogDescription>
              Modify the queue behavior for voucher <b>{editingSeq?.voucher_code}</b>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateSequence} className="space-y-5 py-4">
            
            {/* Row 1: Next Step and Interval */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Next Step (Msg #)</Label>
                <Select value={newStep} onValueChange={setNewStep}>
                  <SelectTrigger className="h-11 bg-gray-50 border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">Step 2 (Msg 1)</SelectItem>
                    <SelectItem value="3">Step 3 (Msg 2)</SelectItem>
                    <SelectItem value="4">Step 4 (Msg 3)</SelectItem>
                    <SelectItem value="5">Step 5 (Msg 4)</SelectItem>
                    <SelectItem value="6">Step 6 (Msg 5)</SelectItem>
                    <SelectItem value="7">Step 7 (Final Msg)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Interval (Hours)</Label>
                <Input 
                  type="number" 
                  min="1" 
                  required 
                  value={newInterval} 
                  onChange={(e) => setNewInterval(e.target.value)} 
                  className="font-mono text-sm font-bold h-11 bg-gray-50 border-gray-200"
                />
              </div>
            </div>

            {/* Row 2: Next Send Date Picker */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Next Send Date & Time</Label>
              <Input 
                type="datetime-local" 
                required 
                value={newNextSendAt} 
                onChange={(e) => setNewNextSendAt(e.target.value)} 
                className="h-11 text-sm font-medium bg-gray-50 border-gray-200"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingSeq(null)} disabled={isUpdating}>Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isUpdating}>
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Configuration
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}