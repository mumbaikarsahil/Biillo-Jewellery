import React, { forwardRef } from 'react'
import QRCode from 'react-qr-code'
import Barcode from 'react-barcode'

// Number to Words Converter
export const numberToWords = (num: number) => {
  const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  
  const format = (n: number): string => {
      if (n < 20) return a[n]
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '')
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + format(n % 100) : '')
      if (n < 100000) return format(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + format(n % 1000) : '')
      if (n < 10000000) return format(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + format(n % 100000) : '')
      return format(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + format(n % 10000000) : '')
  }
  
  if (num === 0) return 'Zero Rupees Only'
  const whole = Math.floor(num)
  return format(whole) + ' Rupees Only'
}

interface InvoicePrintTemplateProps {
  data: any
}

export const InvoicePrintTemplate = forwardRef<HTMLDivElement, InvoicePrintTemplateProps>(
  ({ data }, ref) => {
    if (!data) return null

    const mode = data.mode || 'normal'
    const customOrder = data.customOrder

    // Extracting fields from data object
    const subtotal = data.subtotal || 0
    const discountAmount = data.discountAmount || 0
    const taxableValue = data.taxableValue || (subtotal - discountAmount)
    const cgstAmount = data.cgstAmount || (taxableValue * 0.015)
    const sgstAmount = data.sgstAmount || (taxableValue * 0.015)
    
    // Post-Tax Deductions
    const exchangeVal = data.exchangeValue || 0
    const voucherVal = data.voucherAmount || 0

    // --- DYNAMIC DOCUMENT TEXT & COMPLIANCE ---
    let docTitle = "TAX INVOICE / BILL OF SUPPLY"
    let docNoLabel = "Invoice No. :"
    let legalDisclaimer = "We hereby certify that my/our registration certificate under the Maharashtra Value Added Tax Act 2002 is in force on the date on which the sale of the goods specified in this Tax Invoice is made by me/us and that the transaction of sale covered by this Tax Invoice has been effected by me/us and it shall be accounted for in the turnover of sales while filing of return and the due tax, if payable on the sale has been paid or shall be paid. The diamonds herein invoiced have been purchased from legitimate sources not involved in funding conflict and in compliance with United Nations resolutions. The seller hereby guarantees that these diamonds are conflict free. Subject to Mumbai Jurisdiction."

    if (mode === 'estimate') {
      docTitle = "PROFORMA QUOTATION / ESTIMATE ONLY"
      docNoLabel = "Estimate No. :"
      legalDisclaimer = "ESTIMATE ONLY: This document is a proforma quotation intended for rough estimation purposes only. It does not represent a completed sale, nor does it confirm the final availability or fixed price of the items listed (subject to live gold rates). This document cannot be used for accounting purposes, and cannot be used to claim Input Tax Credit (ITC). No tax has been collected."
    } else if (mode === 'challan') {
      docTitle = "DELIVERY CHALLAN (NOT FOR SALE)"
      docNoLabel = "Challan No. :"
      legalDisclaimer = "DELIVERY CHALLAN: Goods transferred on an approval/memo basis. This is not a tax invoice and does not represent a sale. No statutory charges have been collected. The goods listed herein remain the sole property of OSSAM JEWELS PVT. LTD. until a formal Tax Invoice is generated and full payment is received. The receiver holds the goods in trust and is legally responsible for any damage, loss, or theft."
    } else if (mode === 'custom') {
      docTitle = "ORDER ESTIMATE & ADVANCE RECEIPT"
      docNoLabel = "Receipt No. :"
      legalDisclaimer = "ADVANCE RECEIPT: This document acknowledges the receipt of an advance payment for custom fabrication. The estimated total value provided is provisional. Final pricing will be strictly based on the exact physical weight of the metal and diamonds, plus applicable making charges and statutory charges, calculated at the time of final delivery. Advance amounts are non-refundable once fabrication has commenced."
    }

    const tableColCount = mode === 'normal' ? 6 : 5

    return (
      <div ref={ref} className="w-[210mm] min-h-[297mm] bg-white text-black p-10 font-sans flex flex-col box-border relative overflow-hidden shrink-0">
        
        {/* --- STRICT COMPLIANCE WATERMARKS --- */}
        {mode === 'estimate' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 z-0">
            <span className="text-[130px] font-black -rotate-45 whitespace-nowrap text-slate-900 tracking-widest">
              ESTIMATE ONLY
            </span>
          </div>
        )}
        {mode === 'challan' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 z-0">
            <span className="text-[100px] font-black -rotate-45 whitespace-nowrap text-slate-900 tracking-widest">
              DELIVERY CHALLAN
            </span>
          </div>
        )}

        {/* Everything else goes above the watermark (z-10) */}
        <div className="relative z-10 flex flex-col h-full">
          
          {/* Header Block */}
          <div className="text-center mb-6 border-b-2 border-double border-slate-900 pb-4 relative">
            <div className="absolute top-0 right-0">
               <QRCode value={data.invoice_number || 'N/A'} size={64} />
            </div>

            <p className="text-[10px] font-black uppercase tracking-widest mb-2 text-slate-600">
              {docTitle}
            </p>
            <h1 className="text-4xl sm:text-5xl font-serif text-slate-900 font-bold tracking-[0.05em] mb-1 uppercase">
              Ossam Jewels Pvt. Ltd.
            </h1>
            <h2 className="text-lg font-serif text-slate-700 tracking-[0.2em] mb-3">DIAMOND JEWELLERY</h2>
            <p className="text-xs font-medium">Viral Apartment, (A) Wing, 3rd Floor, S.V. Road, Opp. Andheri Shoppers Stop,</p>
            <p className="text-xs font-medium">Above Hotel Radha Krishna, Andheri West, Mumbai - 400058 Contact : 9322279558</p>
          </div>
          
          {/* Customer & Document Details */}
          <div className="grid grid-cols-2 gap-8 mb-6 text-sm">
            <div className="space-y-2">
              <p><strong>Mr / Mrs / Miss :</strong> <span className="border-b border-black inline-block min-w-[200px] px-2">{data.customer?.full_name}</span></p>
              <p><strong>Address :</strong> <span className="border-b border-black inline-block min-w-[250px] px-2">{data.customer?.address || data.customer?.city || 'Walk-in'}</span></p>
              <div className="flex gap-4">
                <p><strong>Mobile:</strong> <span className="border-b border-black inline-block w-32 px-2">{data.customer?.phone}</span></p>
                <p><strong>D.O.B:</strong> <span className="border-b border-black inline-block w-24 px-2">
                  {data.customer?.birth_date ? new Date(data.customer.birth_date).toLocaleDateString() : ''}
                </span></p>
              </div>
              {/* HIDDEN PAN ON ESTIMATES/CHALLANS */}
              {mode === 'normal' && (
                <p><strong>PAN No. :</strong> <span className="border-b border-black inline-block w-64 px-2 uppercase font-mono">{data.customer?.pan_no || ''}</span></p>
              )}
            </div>
            <div className="space-y-2 flex flex-col items-end text-right">
              <p className="w-full"><strong>Date :</strong> <span className="border-b border-black inline-block w-32 text-center">{new Date(data.date).toLocaleDateString()}</span></p>
              <p className="text-lg font-bold w-full mt-2">{docNoLabel} <span className="text-xl ml-2">{data.invoice_number}</span></p>
              <div className="mt-2 -mr-2">
                 <Barcode value={data.invoice_number || 'N/A'} width={1.2} height={35} fontSize={10} displayValue={false} margin={0} />
              </div>
            </div>
          </div>

          {/* --- DYNAMIC TABLE AREA --- */}
          <div className="flex-1">
            {mode === 'custom' && customOrder ? (
              // CUSTOM ORDER TABLE
              <table className="w-full border-collapse border border-black mb-6 text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-black p-2 text-left">Design Reference</th>
                    <th className="border border-black p-2 text-left">Ornament Category</th>
                    <th className="border border-black p-2 text-center">Expected Gold Wt.</th>
                    <th className="border border-black p-2 text-center">Expected Diamond Cts.</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="h-10 text-center">
                    <td className="border-x border-b border-black p-2 text-left font-bold">{customOrder.designCode}</td>
                    <td className="border-x border-b border-black p-2 text-left">{customOrder.category}</td>
                    <td className="border-x border-b border-black p-2">{customOrder.expectedGoldWt || 'TBD'} g</td>
                    <td className="border-x border-b border-black p-2">{customOrder.expectedDiamondCts || 'TBD'} cts</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              // STANDARD / ESTIMATE / CHALLAN TABLE
              <table className="w-full border-collapse border border-black mb-6 text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-black p-2 text-left w-12">Sr.</th>
                    <th className="border border-black p-2 text-left">Description</th>
                    {/* HIDE HSN ON NON-INVOICES */}
                    {mode === 'normal' && <th className="border border-black p-2 text-center w-24">HSN Code</th>}
                    <th className="border border-black p-2 text-center w-24">Gross Wt.</th>
                    <th className="border border-black p-2 text-center w-24">Net Wt.</th>
                    <th className="border border-black p-2 text-right w-32">
                      {mode === 'challan' ? 'Memo Value' : mode === 'estimate' ? 'Est. Amount' : 'Amount'}
                    </th>
                  </tr>
                </thead>
                <tbody className="align-top"> 
                  {data.items?.map((item: any, idx: number) => (
                    <tr key={idx} className="h-10">
                      <td className="border-x border-black p-2 text-center">{idx + 1}</td>
                      <td className="border-x border-black p-2">
                        <span className="font-bold tracking-widest block uppercase">{item.barcode}</span>
                        <span className="text-[10px] text-slate-600">
                          {item.metal_type} {item.purity || ''} | Stone: {item.dia_wt || '0.00'} cts
                        </span>
                      </td>
                      {mode === 'normal' && <td className="border-x border-black p-2 text-center font-mono">{item.hsn_code || '7113'}</td>}
                      <td className="border-x border-black p-2 text-center">{item.gross_wt?.toFixed(3) || '--'} g</td>
                      <td className="border-x border-black p-2 text-center">{item.net_wt?.toFixed(3) || '--'} g</td>
                      <td className="border-x border-black p-2 text-right font-bold">₹ {item.mrp.toLocaleString()}</td>
                    </tr>
                  ))}
                  {/* Filler Rows to maintain consistent A4 height */}
                  {[...Array(Math.max(0, 5 - (data.items?.length || 0)))].map((_, i) => (
                     <tr key={`filler-${i}`} className="h-10">
                        {Array.from({ length: tableColCount }).map((_, colIdx) => (
                          <td key={colIdx} className="border-x border-black p-2"></td>
                        ))}
                     </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* --- DYNAMIC CALCULATION GRID --- */}
          <div className="grid grid-cols-2 border border-black p-5 mb-8 bg-slate-50/30">
            
            {/* Left Side: Company Info & Amount in Words */}
            <div className="space-y-1 pr-6 flex flex-col justify-between">
              
              {mode === 'normal' ? (
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                   <p>PAN No. : AAOPM1004A</p>
                   <p>GST Tin No.: 27AAOPM1004A1ZB</p>
                </div>
              ) : (
                <div className="text-[11px] font-bold text-slate-400 uppercase italic">
                   <p>Not a Tax Invoice</p>
                   <p>For Internal / Estimation Use Only</p>
                </div>
              )}

              <p className="mt-8 flex items-start text-xs font-black uppercase">
                <span className="mr-2 shrink-0">Amt. in Words :</span> 
                <span className="border-b border-black inline-block w-full leading-tight">
                  {numberToWords(data.finalTotal)}
                </span>
              </p>
            </div>

            {/* Right Side: Compliance-Safe Breakdowns */}
            <div className="border-l border-black pl-5 space-y-1.5 text-sm">
              
              {/* 1. CUSTOM ORDER VIEW */}
              {mode === 'custom' && customOrder && (
                <>
                  <div className="flex justify-between font-medium text-slate-600">
                    <span>Estimated Value (Approx)</span>
                    <span>₹ {Number(customOrder.estimatedValue || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 mt-2 border-t border-black text-xl font-black text-slate-900">
                    <span>Advance Received</span>
                    <span>₹ {data.finalTotal.toLocaleString()}</span>
                  </div>
                </>
              )}

              {/* 2. CHALLAN VIEW (No Taxes Allowed) */}
              {mode === 'challan' && (
                <div className="flex justify-between py-2 text-xl font-black text-slate-900">
                  <span>Total Memo Value</span>
                  <span>₹ {subtotal.toLocaleString()}</span>
                </div>
              )}

              {/* 3. ESTIMATE VIEW (Tax Terminology Scrubbed) */}
              {mode === 'estimate' && (
                <>
                  <div className="flex justify-between font-medium">
                    <span>Estimated Base Value</span>
                    <span>₹ {subtotal.toLocaleString()}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-slate-700 font-bold italic">
                      <span>Discount Applied</span>
                      <span>- ₹ {discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  {/* Replacing explicit CGST/SGST with a generic 'Making & Handling' to keep the math correct but legally safe */}
                  <div className="flex justify-between text-xs text-slate-500 pb-1 border-b border-black">
                    <span>Est. Making & Handling</span>
                    <span>+ ₹ {(cgstAmount + sgstAmount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 text-xl font-black text-slate-900">
                    <span>Estimated Total</span>
                    <span>₹ {data.finalTotal.toLocaleString()}</span>
                  </div>
                </>
              )}

              {/* 4. NORMAL TAX INVOICE VIEW (Fully Itemized GST) */}
              {mode === 'normal' && (
                <>
                  <div className="flex justify-between font-medium"><span>Sub Total</span><span>₹ {subtotal.toLocaleString()}</span></div>
                  
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-slate-700 font-bold italic">
                      <span>Discount Applied</span>
                      <span>- ₹ {discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between border-t border-dotted border-black pt-1 font-bold">
                     <span>Taxable Value</span>
                     <span>₹ {taxableValue.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between text-xs"><span>CGST (1.5%)</span><span>+ ₹ {cgstAmount.toLocaleString()}</span></div>
                  <div className="flex justify-between text-xs pb-1 border-b border-black"><span>SGST (1.5%)</span><span>+ ₹ {sgstAmount.toLocaleString()}</span></div>
                  
                  {(exchangeVal > 0 || voucherVal > 0) && (
                    <div className="space-y-1 py-1 border-b border-black">
                       {exchangeVal > 0 && (
                         <div className="flex justify-between text-slate-700 font-bold italic">
                           <span>Exchange Credit</span>
                           <span>- ₹ {exchangeVal.toLocaleString()}</span>
                         </div>
                       )}
                       {voucherVal > 0 && (
                         <div className="flex justify-between text-slate-700 font-bold italic">
                           <span>Voucher Credit</span>
                           <span>- ₹ {voucherVal.toLocaleString()}</span>
                         </div>
                       )}
                    </div>
                  )}

                  <div className="flex justify-between py-2 text-xl font-black">
                    <span>Net Payable</span>
                    <span>₹ {data.finalTotal.toLocaleString()}</span>
                  </div>
                </>
              )}

            </div>
          </div>

          {/* Signature Area */}
          <div className="flex justify-between items-end text-sm font-bold mb-8 pt-4 shrink-0">
            <div><span className="border-t border-black inline-block w-48 text-center pt-1">Customer / Receiver Signature</span></div>
            <div className="text-center">
                <p className="text-slate-900 font-serif text-xl tracking-[0.1em] font-bold">OSSAM JEWELS PVT. LTD.</p>
            </div>
            <div className="text-right">
              <p className="mb-8 text-xs">For OSSAM JEWELS PVT. LTD.</p>
              <span className="border-t border-black inline-block w-48 text-center pt-1">Authorised Signatory</span>
            </div>
          </div>

          {/* Dynamic Disclaimer Footer */}
          <div className="mt-auto border-t border-slate-300 pt-3">
            <p className="text-[9px] leading-relaxed text-justify text-slate-600 font-medium">
              {legalDisclaimer}
            </p>
          </div>
          
        </div>
      </div>
    )
  }
)

InvoicePrintTemplate.displayName = 'InvoicePrintTemplate'