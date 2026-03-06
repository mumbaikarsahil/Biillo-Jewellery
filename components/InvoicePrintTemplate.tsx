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

    // Fallbacks for Math
    const taxableValue = data.taxableValue || (data.finalTotal / 1.03)
    const cgstAmount = data.cgstAmount || (taxableValue * 0.015)
    const sgstAmount = data.sgstAmount || (taxableValue * 0.015)
    const exchangeVal = data.exchangeValue || 0

    return (
      <div className="hidden">
        {/* A4 Size Wrapper - Flex Col ensures footer stays at bottom without overlapping */}
        <div ref={ref} className="w-[210mm] min-h-[297mm] bg-white text-black p-8 font-sans flex flex-col box-border">
          
          {/* Header Block */}
          <div className="text-center mb-6 border-b-2 border-double border-red-900 pb-4 relative">
            {/* Scannable QR Code containing the Invoice Number */}
            <div className="absolute top-0 right-0">
               <QRCode value={data.invoice_number || 'N/A'} size={64} />
            </div>

            <p className="text-xs font-bold uppercase tracking-widest mb-2 text-slate-600">Tax Invoice</p>
            <h1 className="text-5xl font-serif text-red-900 font-bold tracking-[0.1em] mb-1">OSSAM JEWELS</h1>
            <h2 className="text-xl font-serif text-red-900 tracking-[0.2em] mb-3">DIAMOND JEWELLERY</h2>
            <p className="text-sm font-medium">Viral Apartment, (A) Wing, 3rd Floor, S.V. Road, Opp. Andheri Shoppers Stop,</p>
            <p className="text-sm font-medium">Above Hotel Radha Krishna, Andheri West, Mumbai - 400058 Contact : 9322279558</p>
          </div>
          
          {/* Customer & Invoice Details */}
          <div className="grid grid-cols-2 gap-8 mb-6 text-sm">
            <div className="space-y-2">
              <p><strong>Mr / Mrs / Miss :</strong> <span className="border-b border-black inline-block w-48 px-2">{data.customer?.full_name}</span></p>
              <p><strong>Address :</strong> <span className="border-b border-black inline-block w-64 px-2">{data.customer?.address || data.customer?.city || ''}</span></p>
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
              {/* Actual Scannable Barcode for the Document */}
              <div className="mt-2 -mr-2">
                 <Barcode value={data.invoice_number || 'N/A'} width={1.5} height={40} fontSize={12} displayValue={false} margin={0} />
              </div>
            </div>
          </div>

          {/* Table Area (flex-1 pushes everything else to the bottom of the page) */}
          <div className="flex-1">
            <table className="w-full border-collapse border border-black mb-6">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-black p-2 text-left">Sr. No.</th>
                  <th className="border border-black p-2 text-left">Description</th>
                  <th className="border border-black p-2">HSN Code</th>
                  <th className="border border-black p-2 text-center">Gold Wt.</th>
                  <th className="border border-black p-2 text-center">Dia. Wt.</th>
                  <th className="border border-black p-2 text-right">Amounts</th>
                </tr>
              </thead>
              <tbody className="align-top"> 
                {data.items?.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="border-x border-black p-2 text-center">{idx + 1}</td>
                    <td className="border-x border-black p-2">
                      <span className="font-black tracking-widest text-sm block uppercase mb-1">{item.barcode}</span>
                      <span className="text-xs text-slate-700">
                        <strong className="text-black">GW: {item.gross_wt || '--'}g</strong> | {item.metal_type} {item.purity || ''}
                      </span>
                    </td>
                    <td className="border-x border-black p-2 text-center">{item.hsn_code || '7113'}</td>
                    <td className="border-x border-black p-2 text-center">{item.net_wt || '--'} g</td>
                    <td className="border-x border-black p-2 text-center">{item.dia_wt || '--'} cts</td>
                    <td className="border-x border-black p-2 text-right font-bold">₹ {item.mrp.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Calculation Area */}
          <div className="grid grid-cols-2 border border-black p-4 mb-10">
            <div className="space-y-1 pt-4 text-sm font-bold">
              <p>PAN No. : AAOPM1004A</p>
              <p>GST Tin No.: 27AAOPM1004A1ZB</p>
              <p className="mt-6 flex items-start">
                <span className="mr-2 shrink-0">Amount in Words :</span> 
                <span className="border-b border-black inline-block w-full uppercase">{numberToWords(data.finalTotal)}</span>
              </p>
            </div>
            <div className="border-l border-black pl-4">
              <div className="flex justify-between border-b border-black py-1.5"><span className="font-bold">Sub Total (Taxable)</span><span>₹ {taxableValue.toFixed(2)}</span></div>
              <div className="flex justify-between border-b border-black py-1.5"><span className="font-bold">CGST 1.5%</span><span>₹ {cgstAmount.toFixed(2)}</span></div>
              
              {/* DYNAMIC EXCHANGE ROW RENDERING */}
              <div className={`flex justify-between py-1.5 ${exchangeVal > 0 ? 'border-b border-black' : ''}`}>
                <span className="font-bold">S.GST 1.5%</span>
                <span>₹ {sgstAmount.toFixed(2)}</span>
              </div>
              
              {exchangeVal > 0 && (
                <div className="flex justify-between border-b border-black py-1.5 text-slate-600">
                  <span className="font-bold uppercase tracking-widest text-xs">Less: Exchange Value</span>
                  <span className="font-mono font-bold">- ₹ {exchangeVal.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between py-2 text-lg"><span className="font-black">Net Payable</span><span className="font-black">₹ {data.finalTotal.toFixed(2)}</span></div>
            </div>
          </div>

          {/* Signature Area (Fixed Spacing, no absolute positioning) */}
          <div className="flex justify-between items-end text-sm font-bold mb-6">
            <div><span className="border-t border-black inline-block w-48 text-center pt-1">Cust. Sign.</span></div>
            <div className="text-center">
                <p className="text-red-900 font-serif text-xl tracking-widest">PAVITRAM</p>
                <p className="text-xs font-normal">DIAMOND JEWELLERY</p>
            </div>
            <div className="text-right">
              <p className="mb-8">For OSSAM JEWELS</p>
              <span className="border-t border-black inline-block w-48 text-center pt-1">Authorised Signatory</span>
            </div>
          </div>

          {/* Disclaimer Footer */}
          <p className="text-[9px] leading-tight text-justify text-slate-600 mt-4 border-t border-slate-300 pt-4">
            We hereby certify that my/our registration certificate under the Maharashtra Value Added Tax Act 2002 is in force on the date on which the sale of the goods specified in this Tax Invoice is made by me/us and that the transaction of sale covered by this Tax Invoice has been effected by me/us and it shall be accounted for in the turnover of sales while filing of return and the due tax, if payable on the sale has been paid or shall be paid. The diamonds herein invoiced have been purchased from legitimate sources not involved in funding conflict and in compliance with United Nations resolutions. The seller hereby guarantees that these diamonds are conflict free, based on personal knowledge and/or written guarantees provided by the supplier of these diamonds. Subject to Mumbai Jurisdiction.
          </p>
          
        </div>
      </div>
    )
  }
)

InvoicePrintTemplate.displayName = 'InvoicePrintTemplate'