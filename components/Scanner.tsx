'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScanLine, X } from 'lucide-react'

interface ScannerProps {
  onScan: (barcode: string) => void
  placeholder?: string
  disabled?: boolean
}

export function Scanner({ onScan, placeholder = 'Scan barcode...', disabled = false }: ScannerProps) {
  const [input, setInput] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      onScan(input.trim())
      setInput('')
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setCameraOpen(true)
      }
    } catch (err) {
      console.error('Camera access denied:', err)
      alert('Unable to access camera. Please use manual barcode entry.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    setCameraOpen(false)
  }

  const captureFrame = async () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
        // Here you would typically use a barcode scanning library like @zxing/library
        // For now, we just capture and show instructions
        alert('Barcode scanning via camera requires ZXing library integration. Using manual entry for now.')
        stopCamera()
      }
    }
  }

  return (
    <Card className="p-4 w-full">
      <div className="space-y-3">
        <label className="text-sm font-medium">Barcode Scanner</label>
        <div className="flex gap-2">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || cameraOpen}
            className="flex-1"
            autoFocus
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => (cameraOpen ? stopCamera() : startCamera())}
            disabled={disabled}
          >
            <ScanLine className="h-4 w-4" />
          </Button>
        </div>

        {cameraOpen && (
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-64 object-cover"
            />
            <canvas
              ref={canvasRef}
              className="hidden"
              width={640}
              height={480}
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={stopCamera}
              className="absolute top-2 right-2"
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="absolute bottom-2 left-0 right-0 flex justify-center">
              <Button
                size="sm"
                onClick={captureFrame}
              >
                Capture & Scan
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500">
          Enter barcode manually or use camera to scan
        </p>
      </div>
    </Card>
  )
}
