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

// Clean inline row for customer info
const InfoRow = ({ label, value }: { label: string, value: any }) => (
  <div className="flex items-start mb-2 text-sm">
    <span className="font-bold w-28 shrink-0 text-slate-900">{label}</span>
    <span className="text-slate-800">{value || '-'}</span>
  </div>
)

export const InvoicePrintTemplate = forwardRef<HTMLDivElement, InvoicePrintTemplateProps>(
  ({ data }, ref) => {
    if (!data) return null

    const mode = data.mode || 'normal'
    const customOrder = data.customOrder
    const repair = data.repair 
    const returnDetails = data.returnDetails

    const subtotal = data.subtotal || 0
    const discountAmount = data.discountAmount || 0
    const taxableValue = data.taxableValue || (subtotal - discountAmount)
    const cgstAmount = data.cgstAmount || (taxableValue * 0.015)
    const sgstAmount = data.sgstAmount || (taxableValue * 0.015)
    
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
      legalDisclaimer = "DELIVERY CHALLAN: Goods transferred on an approval/memo basis. This is not a tax invoice and does not represent a sale. No statutory charges have been collected. The goods listed herein remain the sole property of the company until a formal Tax Invoice is generated and full payment is received. The receiver holds the goods in trust and is legally responsible for any damage, loss, or theft."
    } else if (mode === 'custom') {
      docTitle = "ORDER ESTIMATE & ADVANCE RECEIPT"
      docNoLabel = "Receipt No. :"
      legalDisclaimer = "ADVANCE RECEIPT: This document acknowledges the receipt of an advance payment for custom fabrication. The estimated total value provided is provisional. Final pricing will be strictly based on the exact physical weight of the metal and diamonds, plus applicable making charges and statutory charges, calculated at the time of final delivery."
    } else if (mode === 'repair') {
      docTitle = "REPAIR INTAKE & ACKNOWLEDGEMENT RECEIPT"
      docNoLabel = "Ticket No. :"
      legalDisclaimer = "REPAIR ACKNOWLEDGEMENT: We acknowledge receipt of customer property for repair/polishing. While every care is taken, the company is not responsible for minor weight loss due to polishing or stones coming loose due to old settings. Present this original receipt for collection. Items not collected within 90 days are subject to storage fees. Subject to Mumbai Jurisdiction."
    } else if (mode === 'return') {
      docTitle = "BUYBACK / RETURN VOUCHER"
      docNoLabel = "Voucher No. :"
      legalDisclaimer = "BUYBACK VOUCHER: We acknowledge the receipt of the returned item(s) listed above. The valuation is based on standard buyback policies and current market rates. The total refund amount constitutes full and final settlement for the surrendered items. Ownership of the item transfers back to the company."
    }

    const tableColCount = mode === 'normal' ? 6 : 5;
    const currentItemCount = data.items?.length || 0;
    
    // Allows at most 2 filler rows so the table has breathing room but doesn't stretch down
    const emptyRowsToFill = Math.max(0, 2 - currentItemCount); 

    const branchGstin = data.branch?.gstin || '27AAOPM1004A1ZB';
    const branchPan = branchGstin.length >= 12 ? branchGstin.substring(2, 12) : 'AAOPM1004A';

    return (
      <div ref={ref} className="w-[210mm] min-h-[297mm] bg-white text-slate-800 px-8 py-4 font-sans flex flex-col box-border relative overflow-hidden shrink-0">
        
        {/* --- WATERMARKS --- */}
        {mode === 'estimate' && <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0"><span className="text-[130px] font-black -rotate-45 whitespace-nowrap text-[#B254A3] tracking-widest">ESTIMATE ONLY</span></div>}
        {mode === 'challan' && <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0"><span className="text-[100px] font-black -rotate-45 whitespace-nowrap text-[#B254A3] tracking-widest">DELIVERY CHALLAN</span></div>}
        {mode === 'repair' && <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0"><span className="text-[120px] font-black -rotate-45 whitespace-nowrap text-[#B254A3] tracking-widest">REPAIR INTAKE</span></div>}
        {mode === 'return' && <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] z-0"><span className="text-[120px] font-black -rotate-45 whitespace-nowrap text-red-600 tracking-widest">RETURNED</span></div>}

        <div className="relative z-10 flex flex-col h-full">
          
          {/* Top Title (Updated to be highly visible) */}
          <div className="text-center mb-4 mt-2">
            <span className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 border-2 border-slate-800 px-6 py-1.5 rounded-sm inline-block">
              {docTitle}
            </span>
          </div>

          {/* Header Block */}
          <div className="text-center mb-3">
            <h1 className="text-[34px] font-serif font-black tracking-widest mb-1.5 uppercase text-[#B254A3]">
              Ossam Jewels Pvt. Ltd.
            </h1>
            <h2 className="text-[11px] font-bold text-slate-900 tracking-[0.25em] mb-2.5 uppercase">Diamond Jewellery</h2>
            {data.branch?.address ? (
               <p className="text-[10px] font-bold text-slate-700 whitespace-pre-wrap max-w-xl mx-auto leading-snug">
                 {data.branch.address}
               </p>
            ) : (
               <>
                 <p className="text-[10px] font-bold text-slate-700">Viral Apartment, (A) Wing, 3rd Floor, S.V. Road, Opp. Andheri Shoppers Stop,</p>
                 <p className="text-[10px] font-bold text-slate-700">Above Hotel Radha Krishna, Andheri West, Mumbai - 400058</p>
               </>
            )}
            <p className="text-[10px] font-bold text-slate-700 mt-0.5">
              Contact : {data.branch?.contact_number || '9322279558'}
            </p>
          </div>
          
          {/* Thin Gold Divider TOP */}
          <div className="w-full h-[3px] bg-[#EAB308] mb-3"></div>
          
          {/* Top Info Grid */}
          <div className="flex justify-between items-start mb-4 text-sm">
            <div className="space-y-1.5 flex-1 pr-4">
              <div className="flex items-center"><span className="font-bold w-24 text-slate-900">Date :</span><span className="font-medium text-slate-800">{new Date(data.date).toLocaleDateString()}</span></div>
              <div className="flex items-center mt-1"><span className="font-bold w-24 text-slate-900">{docNoLabel}</span><span className="text-base font-bold text-slate-900 tracking-wide">{data.invoice_number}</span></div>
              <div className="mt-3 flex items-center gap-3">
                 <QRCode value={data.invoice_number || 'N/A'} size={50} />
                 <Barcode value={data.invoice_number || 'N/A'} width={1.2} height={40} fontSize={10} displayValue={false} margin={0} />
              </div>
            </div>
            
            <div className="space-y-1 flex-1 pl-10">
              {/* Updated Customer Header */}
              <InfoRow label="Customer Name :" value={data.customer?.full_name} />
              <InfoRow label="Address :" value={data.customer?.address || data.customer?.city} />
              <InfoRow label="Mobile :" value={data.customer?.phone} />
              {mode === 'normal' && <InfoRow label="PAN No. :" value={<span className="uppercase tracking-wider">{data.customer?.pan_no}</span>} />}
              {data.customer?.birth_date && <InfoRow label="D.O.B :" value={new Date(data.customer.birth_date).toLocaleDateString()} />}
              {mode === 'repair' && repair?.expectedDelivery && (
                <div className="flex items-start mb-1.5 text-sm">
                  <span className="font-bold w-28 shrink-0 text-red-600">Delivery Due :</span>
                  <span className="text-red-600 font-bold">{new Date(repair.expectedDelivery).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* --- DYNAMIC TABLE AREA --- */}
          <div className="mb-3">
            {mode === 'custom' && customOrder ? (
              <table className="w-full text-sm">
                <thead className="bg-[#E8A5D8] text-white">
                  <tr>
                    <th className="p-2.5 text-left font-semibold rounded-tl-md">Design Reference</th>
                    <th className="p-2.5 text-left font-semibold">Ornament Category</th>
                    <th className="p-2.5 text-center font-semibold">Expected Gold Wt.</th>
                    <th className="p-2.5 text-center font-semibold rounded-tr-md">Expected Diamond Cts.</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="h-12 text-center bg-white border-b border-slate-200">
                    <td className="p-2.5 text-left font-bold text-slate-800">{customOrder.designCode}</td>
                    <td className="p-2.5 text-left font-medium text-slate-700">{customOrder.category}</td>
                    <td className="p-2.5 font-medium text-slate-700">{customOrder.expectedGoldWt || 'TBD'} g</td>
                    <td className="p-2.5 font-medium text-slate-700">{customOrder.expectedDiamondCts || 'TBD'} cts</td>
                  </tr>
                </tbody>
              </table>
            ) : mode === 'repair' && repair ? (
              <div className="space-y-4">
                <table className="w-full text-sm">
                  <thead className="bg-[#E8A5D8] text-white">
                    <tr>
                      <th className="p-2.5 text-left font-semibold rounded-tl-md">Repair Item Description</th>
                      <th className="p-2.5 text-center font-semibold w-32">Gross Wt.</th>
                      <th className="p-2.5 text-center font-semibold w-32 rounded-tr-md">Purity</th>
                    </tr>
                  </thead>
                  <tbody className="border-b border-slate-200">
                    <tr className="h-16 text-center bg-white border-x border-slate-200">
                      <td className="p-2.5 text-left">
                        <p className="font-bold text-[13px] text-slate-800">{repair.purity || '22K'} Gold Diamond Jewellery</p>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">{repair.itemDescription}</p>
                        {repair.defectNotes && <p className="text-[10px] italic text-slate-500 mt-0.5">Note: {repair.defectNotes}</p>}
                      </td>
                      <td className="p-2.5 font-bold text-lg text-slate-800">{Number(repair.grossWeight).toFixed(3)} g</td>
                      <td className="p-2.5 font-semibold text-slate-700 uppercase">{repair.purity}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : mode === 'return' && returnDetails ? (
              <table className="w-full text-sm">
                <thead className="bg-[#E8A5D8] text-white">
                  <tr>
                    <th className="p-2.5 text-left font-semibold rounded-tl-md">Returned Item Description</th>
                    <th className="p-2.5 text-center font-semibold w-32">Gross Wt.</th>
                    <th className="p-2.5 text-center font-semibold w-32 rounded-tr-md">Purity</th>
                  </tr>
                </thead>
                <tbody className="border-b border-slate-200">
                  <tr className="h-16 text-center bg-white border-x border-slate-200">
                    <td className="p-2.5 text-left">
                      <span className="font-bold text-[13px] block text-slate-800">{returnDetails.purity || '22K'} Gold Diamond Jewellery</span>
                      <span className="text-[10px] text-slate-500 uppercase block mt-1 tracking-wide">{returnDetails.itemDescription}</span>
                      {returnDetails.originalInvoiceNo && <span className="text-[9px] text-slate-400 mt-0.5 block">Ref INV: {returnDetails.originalInvoiceNo}</span>}
                    </td>
                    <td className="p-2.5 font-bold text-lg text-slate-800">{Number(returnDetails.grossWeight || 0).toFixed(3)} g</td>
                    <td className="p-2.5 font-semibold text-slate-700 uppercase">{returnDetails.purity || '-'}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#E8A5D8] text-white">
                  <tr>
                    <th className="p-2.5 text-center font-semibold w-12 rounded-tl-md">Sr.</th>
                    <th className="p-2.5 text-left font-semibold">Description</th>
                    {mode === 'normal' && <th className="p-2.5 text-center font-semibold w-24">HSN Code</th>}
                    {/* Changed Headers to accommodate both gross and added weights */}
                    <th className="p-2.5 text-center font-semibold w-24">Metal (g)</th>
                    <th className="p-2.5 text-center font-semibold w-24">Stone (ct)</th>
                    <th className="p-2.5 text-right font-semibold w-32 rounded-tr-md">
                      {mode === 'challan' ? 'Memo Value' : mode === 'estimate' ? 'Est. Amount' : 'Amount'}
                    </th>
                  </tr>
                </thead>
                <tbody className="align-top border-b border-slate-200"> 
                  {data.items?.map((item: any, idx: number) => {
                    const isRepair = !!item.repair_ticket_id;
                    const gw = item.gross_weight_g || item.gross_weight || item.gross_wt || item.net_weight_g;
                    const dw = item.total_stone_weight_cts || item.diamond_weight_cts || item.dia_wt || item.stone_weight;

                    return (
                      <tr key={idx} className="bg-white border-b border-slate-100">
                        <td className="p-2.5 text-center font-bold text-slate-800 pt-3">{idx + 1}</td>
                        <td className="p-2.5 pt-3">
                          <span className="font-bold block text-[13px] text-slate-800">
                            {isRepair ? 'Repair & Maintenance Service' : `${item.purity || '22K'} Gold Diamond Jewellery`}
                          </span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block tracking-wide">
                            {isRepair 
                              ? `Ticket Ref: ${item.barcode} | ${item.item_category || 'General Repair'}`
                              : `Gold ${item.purity || '22K'} | Stone: ${dw ? Number(dw).toFixed(2) : '0'} cts`
                            }
                          </span>
                        </td>
                        {mode === 'normal' && <td className="p-2.5 text-center font-mono text-[11px] font-bold text-slate-600 pt-3">{item.hsn_code || (isRepair ? '9987' : '7113')}</td>}
                        
                        {/* Intelligent Weight Display */}
                        <td className="p-2.5 text-center font-medium text-slate-700 pt-3">
                          {gw ? Number(gw).toFixed(3) : '--'} g
                          {isRepair && <span className="block text-[8px] text-amber-600 font-bold mt-0.5">ADDED</span>}
                        </td>
                        <td className="p-2.5 text-center font-medium text-slate-700 pt-3">
                          {dw ? Number(dw).toFixed(2) : '--'} cts
                          {isRepair && <span className="block text-[8px] text-amber-600 font-bold mt-0.5">ADDED</span>}
                        </td>
                        
                        <td className="p-2.5 text-right font-bold text-slate-800 pt-3">₹ {item.mrp.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {[...Array(emptyRowsToFill)].map((_, i) => (
                     <tr key={`filler-${i}`} className="bg-white border-b border-slate-100 h-10">
                        {Array.from({ length: tableColCount }).map((_, colIdx) => <td key={colIdx} className="p-2.5"></td>)}
                     </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* --- TOTALS & COMPLIANCE BOX --- */}
          <div className="flex bg-[#FDF2F8] rounded-xl overflow-hidden mb-3 border border-[#F3D9EB]">
            <div className="w-1/2 p-3 flex flex-col justify-between border-r border-[#F3D9EB]">
              {mode === 'normal' ? (
                <div className="text-[11px] font-bold text-slate-600 uppercase space-y-1 tracking-wider">
                   <p>PAN NO. : {branchPan}</p>
                   <p>GST TIN NO.: {branchGstin}</p>
                </div>
              ) : (
                <div className="text-[10px] font-bold text-slate-400 uppercase italic tracking-wider">
                   <p>Not a Tax Invoice</p>
                   <p>For Internal / Estimation Use Only</p>
                </div>
              )}

              <div className="mt-4 bg-white p-3 rounded-lg flex items-center shadow-sm">
                <span className="text-[10px] font-bold text-slate-800 uppercase mr-3 shrink-0">Amt. In Words :</span> 
                <span className="text-[11px] font-bold text-slate-800 uppercase leading-tight tracking-wide">
                  {numberToWords(data.finalTotal)}
                </span>
              </div>
            </div>

            <div className="w-1/2 p-3 space-y-2 text-sm font-semibold text-slate-800 bg-white/40">
              {mode === 'repair' && repair ? (
                <>
                  <div className="flex justify-between text-slate-600"><span>Estimated Cost (Approx)</span><span>₹ {Number(repair.estimatedCost || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between py-2 mt-2 border-t border-slate-300 text-xl font-black text-slate-900"><span>Advance Received</span><span>₹ {data.finalTotal.toLocaleString()}</span></div>
                </>
              ) : mode === 'return' && returnDetails ? (
                <>
                  <div className="flex justify-between text-slate-600"><span>Gross Valuation</span><span>₹ {Number(returnDetails.grossValue || 0).toLocaleString()}</span></div>
                  {Number(returnDetails.deductionAmount) > 0 && (
                    <div className="flex justify-between text-red-600 italic"><span>Deductions</span><span>- ₹ {Number(returnDetails.deductionAmount).toLocaleString()}</span></div>
                  )}
                  <div className="flex justify-between py-2 mt-2 border-t border-slate-300 text-xl font-black text-slate-900"><span>Net Refund Issued</span><span>₹ {data.finalTotal.toLocaleString()}</span></div>
                </>
              ) : mode === 'custom' && customOrder ? (
                <>
                  <div className="flex justify-between text-slate-600"><span>Estimated Value (Approx)</span><span>₹ {Number(customOrder.estimatedValue || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between py-2 mt-2 border-t border-slate-300 text-xl font-black text-slate-900"><span>Advance Received</span><span>₹ {data.finalTotal.toLocaleString()}</span></div>
                </>
              ) : mode === 'challan' ? (
                <div className="flex justify-between py-2 text-xl font-black text-slate-900"><span>Total Memo Value</span><span>₹ {subtotal.toLocaleString()}</span></div>
              ) : mode === 'estimate' ? (
                <>
                  <div className="flex justify-between"><span>Sub Total</span><span>₹ {subtotal.toLocaleString()}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-[#A85B9D] italic"><span>Discount Applied</span><span>- ₹ {discountAmount.toLocaleString()}</span></div>}
                  <div className="flex justify-between border-t border-slate-300 pt-1.5 mt-1.5"><span>Taxable Value</span><span>₹ {taxableValue.toLocaleString()}</span></div>
                  
                  <div className="flex justify-between text-xs text-slate-600"><span>Handling Charges (1.5%)</span><span>+ ₹ {cgstAmount.toLocaleString()}</span></div>
                  <div className="flex justify-between text-xs text-slate-600 pb-1.5"><span>Making Charges (1.5%)</span><span>+ ₹ {sgstAmount.toLocaleString()}</span></div>
                  
                  <div className="flex justify-between py-2 mt-1 border-t border-slate-300 text-xl font-black text-slate-900"><span>Estimated Total</span><span>₹ {data.finalTotal.toLocaleString()}</span></div>
                </>
              ) : (
                <>
                  <div className="flex justify-between"><span>Sub Total</span><span>₹ {subtotal.toLocaleString()}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-[#A85B9D] italic"><span>Discount Applied</span><span>- ₹ {discountAmount.toLocaleString()}</span></div>}
                  <div className="flex justify-between border-t border-slate-300 pt-1.5 mt-1.5"><span>Taxable Value</span><span>₹ {taxableValue.toLocaleString()}</span></div>
                  <div className="flex justify-between text-xs text-slate-600"><span>CGST (1.5%)</span><span>+ ₹ {cgstAmount.toLocaleString()}</span></div>
                  <div className="flex justify-between text-xs text-slate-600 pb-1.5"><span>SGST (1.5%)</span><span>+ ₹ {sgstAmount.toLocaleString()}</span></div>
                  
                  {(exchangeVal > 0 || voucherVal > 0) && (
                    <div className="space-y-1 py-1.5 border-t border-slate-200">
                       {exchangeVal > 0 && <div className="flex justify-between text-[#A85B9D] italic text-xs"><span>Exchange Credit</span><span>- ₹ {exchangeVal.toLocaleString()}</span></div>}
                       {voucherVal > 0 && <div className="flex justify-between text-[#A85B9D] italic text-xs"><span>Voucher Credit</span><span>- ₹ {voucherVal.toLocaleString()}</span></div>}
                    </div>
                  )}
                  
                  {/* Shows advance payment deduction correctly on final bill if custom order or repair is present in cart */}
                  {data.items?.some((i: any) => i.advance_paid) && (
                    <div className="flex justify-between font-bold text-[#A85B9D] text-xs pt-1 border-t border-slate-200">
                      <span>Advance Received</span>
                      <span>- ₹ {data.items.reduce((sum: number, i: any) => sum + (Number(i.advance_paid) || 0), 0).toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-2 mt-1 border-t border-slate-300 text-xl font-black text-slate-900"><span>Net Payable</span><span>₹ {data.finalTotal.toLocaleString()}</span></div>
                </>
              )}
            </div>
          </div>

          {/* Wraps all bottom elements and pushes them to the absolute bottom together */}
          <div className="mt-auto flex flex-col shrink-0">
            
            {/* Signature Area */}
            <div className="grid grid-cols-3 items-end text-sm font-bold mb-4 mt-2 relative">
              
              <div className="text-center px-6 relative">
                {/* --- DYNAMIC STAMP (Displays only on new sales/estimates/custom) --- */}
                {['normal', 'estimate', 'custom'].includes(mode) && (
                  <img 
                    src="/exchange-stamp.png" 
                    alt="100% Exchange Guarantee" 
                    className="absolute -top-16 left-1/2 -translate-x-1/2 h-[72px] w-[72px] object-contain -rotate-12 opacity-90" 
                    onError={(e) => e.currentTarget.style.display = 'none'} 
                  />
                )}
                
                <div className="border-t border-black pt-1.5 text-[11px] uppercase tracking-wider">
                  {(mode === 'repair' || mode === 'return') ? 'Customer Signature' : 'Customer / Receiver Signature'}
                </div>
              </div>
              
              <div className="text-center flex flex-col items-center justify-center -mt-8 z-10">
              <img src="/pavitram-logo.jpg" alt="Pavitram" className="h-16 mx-auto mb-1 opacity-90 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
              </div>
              
              <div className="text-center px-6">
                <p className="mb-8 text-[10px] text-slate-800 uppercase tracking-wider font-bold">For OSSAM JEWELS PVT. LTD.</p>
                <div className="border-t border-black pt-1.5 text-[11px] uppercase tracking-wider">
                  Authorised Signatory
                </div>
              </div>
            </div>

            {/* Thin Gold Divider BOTTOM */}
            <div className="w-full h-[3px] bg-[#EAB308] mt-2 mb-2"></div>

            {/* Dynamic Disclaimer Footer */}
            <div className="pt-1 pb-4 flex flex-col text-left">
              {/* --- NEW: CUSTOM ORDER TERMS & CONDITIONS --- */}
              {mode === 'custom' && (
                <div className="pb-1.5 text-[7.5px] leading-snug text-slate-700 font-bold uppercase tracking-tight">
                  <p className="underline mb-0.5">Terms & Conditions:</p>
                  <p>1) Order once placed can not be cancelled.</p>
                  <p>2) 30% will be deducted from the Total ordered Amount if order Cancelled.</p>
                </div>
              )}
              {/* ------------------------------------------- */}
              <p className="text-[7.5px] leading-snug text-justify text-slate-500 font-bold uppercase tracking-tight">
                {legalDisclaimer}
              </p>
            </div>

            {/* --- PROMOTIONAL BRAND BANNER --- */}
            <div className="w-full h-[150px] rounded-xl overflow-hidden border border-slate-200 relative">
              <img 
                src={data.bannerUrl || "https://mfdjlbvqfbujipihehpt.supabase.co/storage/v1/object/public/brand-assets/invoice-banner.jpg"} 
                alt="Pavitram Promotional Banner" 
                className="w-full h-full object-cover object-center"
                crossOrigin="anonymous" 
              />
            </div>

          </div>
          
        </div>
      </div>
    )
  }
)

InvoicePrintTemplate.displayName = 'InvoicePrintTemplate'