"use client"

import React, { useState, useRef, useEffect } from "react"
import { Send, Loader2, Bot, User, Database, ChevronDown, ChevronUp, Sparkles, ShieldAlert, Zap } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  data?: any;
}

export default function AiAssistantPage() {
  const { appUser } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const cleanMessageText = (text: string) => {
    return text.replace(/\*\*/g, "").replace(/\*/g, "")
  }

  const sendMessage = async (e: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault()
    const textToSend = customText || input
    if (!textToSend.trim() || isLoading) return

    setInput("")
    const newMessageId = Date.now().toString()
    
    const updatedMessages: ChatMessage[] = [...messages, { id: newMessageId, role: 'user', text: textToSend }]
    setMessages(updatedMessages)
    setIsLoading(true)

    try {
      const chatHistory = updatedMessages.map(msg => ({
        role: msg.role,
        content: msg.text
      }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: textToSend, 
          companyId: appUser?.company_id,
          history: chatHistory 
        })
      })

      if (!response.ok) throw new Error("Network response was not ok")
      const result = await response.json()

      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        text: cleanMessageText(result.text),
        data: result.data 
      }])
    } catch (error) {
      console.error(error)
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        text: "Sorry, I encountered an error communicating with the database." 
      }])
    } finally {
      setIsLoading(false)
    }
  }

  // Extracted input field for perfect code reuse
  const renderInputForm = (isCentered: boolean) => (
    <div className={`w-full ${isCentered ? 'max-w-2xl mt-8 mx-auto' : 'max-w-4xl mx-auto'} flex flex-col gap-1.5 sm:gap-2`}>
      <form onSubmit={(e) => sendMessage(e)} className="relative flex items-center w-full">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about inventory, revenue, job bags, or customer points..."
          className="w-full bg-slate-100/80 border border-slate-200 text-slate-800 text-sm rounded-full pl-4 sm:pl-5 pr-12 sm:pr-14 py-3.5 sm:py-4 focus:outline-hidden focus:ring-2 focus:ring-purple-500/40 focus:bg-white focus:border-purple-400 transition-all shadow-inner font-normal placeholder:text-slate-400"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="absolute right-1.5 h-9 sm:h-10 w-9 sm:w-10 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-full flex items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4 ml-0.5" />
        </button>
      </form>
      
      <p className="text-[10px] sm:text-[11px] text-slate-400 text-center flex items-center justify-center gap-1 sm:gap-1.5 pt-0.5 font-medium px-2 leading-tight">
        <span>Biillo AI can make mistakes. Verify critical financial records against core ledger reports.</span>
      </p>
    </div>
  )

  return (
    <div className="flex flex-col h-full min-h-full max-h-[100dvh] bg-slate-50/50 font-sans text-slate-800 overflow-hidden overscroll-none">
      
      {/* Secondary App Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 shadow-2xs z-10">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-2 rounded-xl text-white shadow-xs shadow-purple-500/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-slate-900 text-sm sm:text-base leading-tight tracking-tight">Biillo AI Intelligence</h1>
            <span className="inline-flex items-center gap-1 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              <Zap className="h-2.5 w-2.5 fill-purple-500 text-purple-500" /> Early Access
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 w-full mx-auto flex flex-col overscroll-contain">
        
        {messages.length === 0 ? (
          /* STATE 1: Centered Gemini Landing Layout */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-2 max-w-4xl mx-auto w-full py-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/80 border border-slate-200 text-slate-600 text-xs font-semibold mb-4 sm:mb-6 shadow-2xs">
              <Sparkles className="h-3.5 w-3.5 text-purple-600 animate-pulse" />
              <span>HEADQUARTERS TERMINAL</span>
            </div>

            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-2 sm:mb-3">
              <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Good morning, {appUser?.full_name || "System Manager"}.
              </span>
            </h2>
            <p className="text-xl sm:text-3xl lg:text-4xl font-bold text-slate-800 tracking-tight mb-8 sm:mb-10">
              How can I help you today?
            </p>

            {/* Quick Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl text-left">
              {[
                { title: "Inventory Check", desc: "How many tops are at Andheri West?", query: "How many tops are at Andheri West?" },
                { title: "Revenue Analysis", desc: "What is our total sales revenue today?", query: "What is our total sales revenue today?" },
                { title: "Job Bag Tracking", desc: "Check the status of job bag JB-1002", query: "Check the status of job bag JB-1002" }
              ].map((card, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => sendMessage(e, card.query)}
                  className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-purple-300 hover:shadow-md active:scale-[0.98] transition-all text-left flex flex-col justify-between group cursor-pointer shadow-2xs"
                >
                  <span className="text-xs font-bold text-slate-900 group-hover:text-purple-600 transition-colors mb-1.5 sm:mb-2">{card.title}</span>
                  <span className="text-xs text-slate-500 leading-relaxed">{card.desc}</span>
                </button>
              ))}
            </div>

            {/* ✨ INPUT BAR PLACED SECURELY IN CENTER UNDER CARDS */}
            {renderInputForm(true)}
          </div>
        ) : (
          
          /* STATE 2: Active Dynamic Conversation Stream Layout */
          <div className="space-y-6 pt-2 max-w-4xl mx-auto w-full pb-24">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[90%] sm:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-xs text-xs font-bold ${
                    msg.role === 'user' 
                      ? 'bg-slate-800 text-white' 
                      : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white'
                  }`}>
                    {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>

                  <div className="flex flex-col gap-2 min-w-0">
                    <div className={`p-3.5 sm:p-4 rounded-2xl shadow-2xs text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-slate-800 text-white rounded-tr-none font-medium' 
                        : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-none font-normal'
                    }`}>
                      {msg.text}
                    </div>

                    {msg.data && !msg.data.error && (
                      <DataPayloadViewer data={msg.data} />
                    )}
                  </div>

                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex w-full justify-start">
                <div className="flex gap-3 max-w-[85%] flex-row items-end">
                  <div className="shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center shadow-xs">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="px-4 py-3 bg-white border border-slate-200/80 rounded-2xl rounded-tl-none shadow-2xs flex items-center gap-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                    <span className="text-xs text-slate-500 font-medium tracking-wide">Analyzing database records...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

      </div>

      {/* STATE 2 FOOTER: Fixed bottom position, ONLY renders when conversation is active */}
      {messages.length > 0 && (
        <div className="bg-white/90 backdrop-blur-md border-t border-slate-200/80 p-3 sm:p-4 shrink-0 shadow-lg shadow-slate-100 z-10 transition-all">
          {renderInputForm(false)}
        </div>
      )}
    </div>
  )
}

function DataPayloadViewer({ data }: { data: any }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mt-1 w-full max-w-md shadow-md transition-all">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-800/90 hover:bg-slate-800 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
          <Database className="h-3.5 w-3.5 text-purple-400 shrink-0" />
          <span>Verified Database Payload</span>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      
      {isOpen && (
        <div className="p-3 bg-slate-950 overflow-x-auto border-t border-slate-800/80 max-h-60 overscroll-contain">
          <pre className="text-[10px] sm:text-[11px] text-emerald-400 font-mono leading-relaxed">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}