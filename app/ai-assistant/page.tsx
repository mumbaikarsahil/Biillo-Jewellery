"use client"

import React, { useState, useRef, useEffect } from "react"
import { Send, Loader2, User, Database, ChevronDown, ChevronUp, Plus, Mic, Square } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  data?: any;
}

// Authentic Gemini 4-point star SVG
const GeminiStar = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gemini-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4285F4" />
        <stop offset="33%" stopColor="#9b72cb" />
        <stop offset="66%" stopColor="#d96570" />
        <stop offset="100%" stopColor="#f9ab00" />
      </linearGradient>
    </defs>
    <path
      d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
      fill="url(#gemini-gradient)"
    />
  </svg>
)

export default function AiAssistantPage() {
  const { appUser } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  
  // ✨ FIX: Strict container scrolling to prevent UI layout jumps
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)

  // Scroll to bottom without shifting the global page layout
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [messages, isLoading])

  // Auto-resize textarea when speech recognition changes the input
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN'; 

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setInput(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setInput(""); 
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const cleanMessageText = (text: string) => {
    return text.replace(/\*\*/g, "").replace(/\*/g, "")
  }

  // ✨ FIX: Smart Textarea input handler
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (but allow Shift+Enter for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const sendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault()
    const textToSend = customText || input
    if (!textToSend.trim() || isLoading) return

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    setInput("")
    // Reset textarea height instantly
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    
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
        text: "Sorry, I encountered an error communicating with the system database." 
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-60px)] w-full bg-[#131314] font-sans text-slate-200 overflow-hidden relative">
      
      {/* ---------------- Top Header ---------------- */}
      <header className="h-14 px-4 md:px-6 flex items-center justify-between shrink-0 z-20 sticky top-0">
        <button className="flex items-center gap-1.5 hover:bg-white/5 px-2 py-1 rounded-lg transition-colors">
          <span className="text-[17px] font-medium text-slate-200">Biillo <span className="text-slate-400">Pro</span></span>
          <ChevronDown className="w-4 h-4 text-slate-400 mt-0.5" />
        </button>
        <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center bg-white/5">
           <User className="w-4 h-4 text-slate-400" />
        </div>
      </header>

      {/* ---------------- Main Content Body ---------------- */}
      {/* ✨ FIX: Assigned ref here for strict internal scrolling */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto w-full mx-auto flex flex-col custom-scrollbar">
        
        {messages.length === 0 ? (
          /* STATE 1: Centered Landing Hero */
          <div className="flex-1 flex flex-col items-center justify-center text-center my-auto px-6 animate-in fade-in duration-700 max-w-3xl mx-auto w-full pb-10">
            
            <div className="mb-6">
              <GeminiStar className="w-12 h-12 md:w-14 md:h-14" />
            </div>

            <div className="w-full flex flex-col items-center">
              <h2 className="text-[32px] sm:text-[40px] md:text-[44px] leading-tight font-medium tracking-tight mb-1">
                <span className="bg-gradient-to-r from-[#4285F4] via-[#9b72cb] to-[#d96570] bg-clip-text text-transparent">
                  Hello, {appUser?.full_name?.split(' ')[0] || "Sahil"}
                </span>
              </h2>
              <p className="text-[32px] sm:text-[40px] md:text-[44px] leading-tight font-medium text-[#5f6368] tracking-tight">
                How can I help you today?
              </p>
            </div>
            
          </div>
        ) : (
          
          /* STATE 2: Conversation Stream */
          <div className="space-y-8 pt-4 pb-6 px-4 md:px-6 w-full max-w-4xl mx-auto animate-in fade-in duration-300">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-4 max-w-[95%] sm:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {/* Avatar */}
                  <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center mt-1 ${
                    msg.role === 'user' ? 'bg-slate-700 text-slate-200' : 'bg-transparent'
                  }`}>
                    {msg.role === 'user' ? <User className="h-4 w-4" /> : <GeminiStar className="w-7 h-7" />}
                  </div>

                  {/* Message Content */}
                  <div className="flex flex-col gap-3 min-w-0">
                    <div className={`text-[15px] leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-[#1e1f20] px-5 py-3 rounded-3xl text-slate-200 font-normal' 
                        : 'text-slate-200 py-1 font-normal'
                    }`}>
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    </div>

                    {/* Expandable JSON Data */}
                    {msg.data && !msg.data.error && (
                      <DataPayloadViewer data={msg.data} />
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Loading State */}
            {isLoading && (
              <div className="flex w-full justify-start animate-in fade-in">
                <div className="flex gap-4 max-w-[85%] flex-row items-center">
                  <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center">
                    <GeminiStar className="w-7 h-7 animate-pulse" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------------- Bottom Floating Input Area ---------------- */}
      <footer className="w-full bg-[#131314] px-4 pt-2 pb-[80px] md:pb-6 shrink-0 z-20 border-t border-transparent">
        <div className="max-w-3xl mx-auto w-full relative">
          
          {/* ✨ FIX: Used items-end so buttons stay at bottom as textarea expands */}
          <form onSubmit={sendMessage} className="relative flex items-end w-full bg-[#1e1f20] rounded-[28px] min-h-[56px] px-2 shadow-sm py-2">
            
            <button type="button" className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full hover:bg-white/5 text-[#c4c7c5] transition-colors mb-0.5">
              <Plus className="w-6 h-6" />
            </button>

            {/* ✨ FIX: Dynamic Auto-resizing Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={isListening ? "Listening..." : "Enter a prompt here"}
              className="flex-1 bg-transparent border-none text-slate-200 text-base pl-3 pr-4 focus:outline-none focus:ring-0 placeholder:text-[#c4c7c5] font-normal resize-none py-2.5 max-h-32 custom-scrollbar"
              disabled={isLoading}
              style={{ overflowY: 'auto' }}
            />
            
            <div className="flex items-center gap-1 pr-1 mb-0.5">
              {!input.trim() && !isListening ? (
                 <button 
                   type="button" 
                   onClick={toggleListening}
                   className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full hover:bg-white/5 text-[#c4c7c5] transition-colors"
                 >
                   <Mic className="w-[22px] h-[22px]" />
                 </button>
              ) : isListening ? (
                 <button 
                   type="button" 
                   onClick={toggleListening}
                   className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors animate-pulse"
                 >
                   <Square className="w-4 h-4 fill-current" />
                 </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full transition-all duration-300 bg-white/10 hover:bg-white/20 text-white active:scale-95"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
                </button>
              )}
            </div>

          </form>

          <p className="text-[11px] text-[#5f6368] text-center pt-3 font-normal px-2">
            Biillo AI processes real-time database records. Verify critical financial entries against ledger logs.
          </p>
        </div>
      </footer>
    </div>
  )
}

function DataPayloadViewer({ data }: { data: any }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="bg-[#1e1f20] border border-white/5 rounded-2xl overflow-hidden mt-2 w-full max-w-lg transition-all">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <Database className="h-4 w-4 text-[#9b72cb] shrink-0" />
          <span>View ERP Payload Data</span>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </button>
      
      {isOpen && (
        <div className="p-4 bg-[#131314] overflow-x-auto border-t border-white/5 max-h-60 custom-scrollbar">
          <pre className="text-[11px] text-[#4285F4] font-mono leading-relaxed">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}