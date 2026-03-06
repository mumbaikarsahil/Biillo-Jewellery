'use client'

import React, { useEffect, useState, useRef, use } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Printer, Download, CheckCircle2 } from 'lucide-react'
import QRCode from 'react-qr-code'
import { useReactToPrint } from 'react-to-print'

export default function TransferVoucher({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap the params using React.use() to fix the Next.js 15 warning
  const resolvedParams = use(params)
  const transferId = resolvedParams.id

  const [transfer, setTransfer] = useState<any>(null)
  const voucherRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: voucherRef,
  })

  useEffect(() => {
    const fetchTransfer = async () => {
      const { data } = await supabase
        .from('stock_transfers')
        .select('*, from:from_warehouse_id(name), to:to_warehouse_id(name), items:stock_transfer_item_lines(inventory_items(*))')
        .eq('id', transferId)
        .single()
      setTransfer(data)
    }
    
    if (transferId) {
      fetchTransfer()
    }
  }, [transferId])

  if (!transfer) return <div className="p-8 text-center text-muted-foreground">Loading Voucher...</div>

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-8 no-print">
        <h1 className="text-xl font-bold">Transfer Voucher Generated</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Print Voucher
          </Button>
          <Button onClick={() => window.location.href = '/transfer'}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* PRINTABLE VOUCHER */}
      <div ref={voucherRef} className="bg-white p-10 border shadow-sm space-y-8">
        <div className="flex justify-between items-start border-b pb-6">
          <div>
            <h2 className="text-2xl font-bold text-primary">Pavitram Diamond Jewellery</h2>
            <p className="text-sm text-muted-foreground">Stock Transfer Voucher</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg">{transfer.transfer_number}</p>
            <p className="text-sm">{new Date(transfer.dispatched_at).toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-12 bg-slate-50 p-6 rounded-lg">
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">From (Sender)</p>
            <p className="font-bold text-lg">{transfer.from.name}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground mb-1">To (Receiver)</p>
            <p className="font-bold text-lg text-primary">{transfer.to.name}</p>
          </div>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-sm text-muted-foreground">
              <th className="py-2">#</th>
              <th className="py-2">Barcode</th>
              <th className="py-2">Item Group</th>
              <th className="py-2 text-right">Net Wt (g)</th>
            </tr>
          </thead>
          <tbody>
            {transfer.items.map((line: any, idx: number) => (
              <tr key={idx} className="border-b text-sm">
                <td className="py-3">{idx + 1}</td>
                <td className="py-3 font-mono font-bold">{line.inventory_items.barcode}</td>
                <td className="py-3">{line.inventory_items.item_category}</td>
                <td className="py-3 text-right">{line.inventory_items.net_weight_g}g</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between items-end pt-12">
          <div className="text-center space-y-2">
            <div className="bg-white p-2 border inline-block">
              {/* This QR contains the Transfer ID for the branch to scan */}
              <QRCode value={transfer.id} size={100} />
            </div>
            
            {/* ADDED: The raw transfer ID text just in case the QR is damaged */}
            <p className="text-[10px] font-mono text-slate-500 w-48 mx-auto break-all">
              {transfer.id}
            </p>
            
            <p className="text-[10px] uppercase font-bold text-muted-foreground pt-2">Scan to Confirm Receipt</p>
          </div>
          
          <div className="text-right space-y-12">
            <div className="border-t border-black w-48 text-center pt-2 text-xs">Sender's Signature</div>
            <div className="border-t border-black w-48 text-center pt-2 text-xs">Receiver's Signature</div>
          </div>
        </div>
      </div>
    </div>
  )
}