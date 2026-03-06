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

    // Extracting fields from data object
    const subtotal = data.subtotal || 0
    const discountAmount = data.discountAmount || 0
    const taxableValue = data.taxableValue || (subtotal - discountAmount)
    const cgstAmount = data.cgstAmount || (taxableValue * 0.015)
    const sgstAmount = data.sgstAmount || (taxableValue * 0.015)
    
    // Post-Tax Deductions
    const exchangeVal = data.exchangeValue || 0
    const voucherVal = data.voucherAmount || 0

    return (
      <div className="hidden">
        {/* A4 Size Wrapper */}
        <div ref={ref} className="w-[210mm] min-h-[297mm] bg-white text-black p-10 font-sans flex flex-col box-border">
          
          {/* Header Block */}
          <div className="text-center mb-6 border-b-2 border-double border-red-900 pb-4 relative">
            <div className="absolute top-0 right-0">
               <QRCode value={data.invoice_number || 'N/A'} size={64} />
            </div>

            <p className="text-[10px] font-black uppercase tracking-widest mb-2 text-slate-500">Tax Invoice / Bill of Supply</p>
            <h1 className="text-5xl font-serif text-red-900 font-bold tracking-[0.1em] mb-1">OSSAM JEWELS</h1>
            <h2 className="text-xl font-serif text-red-900 tracking-[0.2em] mb-3">DIAMOND JEWELLERY</h2>
            <p className="text-xs font-medium">Viral Apartment, (A) Wing, 3rd Floor, S.V. Road, Opp. Andheri Shoppers Stop,</p>
            <p className="text-xs font-medium">Above Hotel Radha Krishna, Andheri West, Mumbai - 400058 Contact : 9322279558</p>
          </div>
          
          {/* Customer & Invoice Details */}
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
              <p><strong>PAN No. :</strong> <span className="border-b border-black inline-block w-64 px-2 uppercase font-mono">{data.customer?.pan_no || ''}</span></p>
            </div>
            <div className="space-y-2 flex flex-col items-end text-right">
              <p className="w-full"><strong>Date :</strong> <span className="border-b border-black inline-block w-32 text-center">{new Date(data.date).toLocaleDateString()}</span></p>
              <p className="text-lg font-bold w-full mt-2">Invoice No. : <span className="text-xl ml-2">{data.invoice_number}</span></p>
              <div className="mt-2 -mr-2">
                 <Barcode value={data.invoice_number || 'N/A'} width={1.2} height={35} fontSize={10} displayValue={false} margin={0} />
              </div>
            </div>
          </div>

          {/* Table Area */}
          <div className="flex-1">
            <table className="w-full border-collapse border border-black mb-6 text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-black p-2 text-left">Sr. No.</th>
                  <th className="border border-black p-2 text-left">Description</th>
                  <th className="border border-black p-2">HSN Code</th>
                  <th className="border border-black p-2 text-center">Gross Wt.</th>
                  <th className="border border-black p-2 text-center">Net Wt.</th>
                  <th className="border border-black p-2 text-right">Amount</th>
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
                    <td className="border-x border-black p-2 text-center font-mono">{item.hsn_code || '7113'}</td>
                    <td className="border-x border-black p-2 text-center">{item.gross_wt?.toFixed(3) || '--'} g</td>
                    <td className="border-x border-black p-2 text-center">{item.net_wt?.toFixed(3) || '--'} g</td>
                    <td className="border-x border-black p-2 text-right font-bold">₹ {item.mrp.toLocaleString()}</td>
                  </tr>
                ))}
                {/* Filler Rows to maintain height */}
                {[...Array(Math.max(0, 5 - (data.items?.length || 0)))].map((_, i) => (
                   <tr key={`filler-${i}`} className="h-10">
                      <td className="border-x border-black p-2"></td>
                      <td className="border-x border-black p-2"></td>
                      <td className="border-x border-black p-2"></td>
                      <td className="border-x border-black p-2"></td>
                      <td className="border-x border-black p-2"></td>
                      <td className="border-x border-black p-2"></td>
                   </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Calculation Area */}
          <div className="grid grid-cols-2 border border-black p-5 mb-8">
            <div className="space-y-1 pr-6 flex flex-col justify-between">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                 <p>PAN No. : AAOPM1004A</p>
                 <p>GST Tin No.: 27AAOPM1004A1ZB</p>
              </div>
              <p className="mt-8 flex items-start text-xs font-black">
                <span className="mr-2 shrink-0">Amount in Words :</span> 
                <span className="border-b border-black inline-block w-full uppercase leading-tight">{numberToWords(data.finalTotal)}</span>
              </p>
            </div>
            <div className="border-l border-black pl-5 space-y-1.5 text-sm">
              <div className="flex justify-between font-medium"><span>Sub Total</span><span>₹ {subtotal.toLocaleString()}</span></div>
              
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-600 font-bold italic">
                  <span>Manual Discount</span>
                  <span>- ₹ {discountAmount.toLocaleString()}</span>
                </div>
              )}
              
              <div className="flex justify-between border-t border-dotted border-black pt-1 font-bold">
                 <span>Taxable Value</span>
                 <span>₹ {taxableValue.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between text-xs"><span>CGST 1.5%</span><span>+ ₹ {cgstAmount.toLocaleString()}</span></div>
              <div className="flex justify-between text-xs pb-1 border-b border-black"><span>SGST 1.5%</span><span>+ ₹ {sgstAmount.toLocaleString()}</span></div>
              
              {(exchangeVal > 0 || voucherVal > 0) && (
                <div className="space-y-1 py-1 border-b border-black">
                   {exchangeVal > 0 && (
                     <div className="flex justify-between text-purple-700 font-bold italic">
                       <span>Exchange Credit</span>
                       <span>- ₹ {exchangeVal.toLocaleString()}</span>
                     </div>
                   )}
                   {voucherVal > 0 && (
                     <div className="flex justify-between text-emerald-600 font-bold italic">
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
            </div>
          </div>

          {/* Signature Area */}
          <div className="flex justify-between items-end text-sm font-bold mb-10 pt-4">
            <div><span className="border-t border-black inline-block w-48 text-center pt-1">Customer Signature</span></div>
            <div className="text-center">
                <p className="text-red-900 font-serif text-2xl tracking-[0.2em] font-bold">PAVITRAM</p>
                <p className="text-[10px] font-normal uppercase tracking-widest text-slate-500">Exquisite Diamond Jewellery</p>
            </div>
            <div className="text-right">
              <p className="mb-10 text-xs">For OSSAM JEWELS</p>
              <span className="border-t border-black inline-block w-48 text-center pt-1">Authorised Signatory</span>
            </div>
          </div>

          {/* Disclaimer Footer */}
          <p className="text-[9px] leading-[1.3] text-justify text-slate-500 border-t border-slate-200 pt-5">
            We hereby certify that my/our registration certificate under the Maharashtra Value Added Tax Act 2002 is in force on the date on which the sale of the goods specified in this Tax Invoice is made by me/us and that the transaction of sale covered by this Tax Invoice has been effected by me/us and it shall be accounted for in the turnover of sales while filing of return and the due tax, if payable on the sale has been paid or shall be paid. The diamonds herein invoiced have been purchased from legitimate sources not involved in funding conflict and in compliance with United Nations resolutions. The seller hereby guarantees that these diamonds are conflict free, based on personal knowledge and/or written guarantees provided by the supplier. Subject to Mumbai Jurisdiction.
          </p>
          
        </div>
      </div>
    )
  }
)

InvoicePrintTemplate.displayName = 'InvoicePrintTemplate'