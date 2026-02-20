'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Building2, Coins, Gem, FileText, ShieldCheck, ChevronLeft, Save, MapPin, Landmark } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

// --- Interfaces (Kept exactly as provided) ---
type AddressType = 'Registered' | 'Billing' | 'Corporate' | 'Warehouse'
type TaxRegistrationType = 'GST' | 'TDS' | 'TCS' | 'IEC'
type BankAccountType = 'CURRENT' | 'SAVINGS' | 'CC' | 'OD'

interface CompanyAddress {
  id?: string
  address_type: AddressType
  line1: string
  line2: string
  city: string
  state: string
  country: string
  pincode: string
  is_default: boolean
}

interface TaxRegistration {
  id?: string
  registration_type: TaxRegistrationType
  registration_number: string
  state_code: string
  effective_from: string
  effective_to?: string
  is_default: boolean
}

interface BankAccount {
  id?: string
  bank_name: string
  account_name: string
  account_number: string
  ifsc_code: string
  account_type: BankAccountType
  is_default_for_sales: boolean
  is_default_for_purchases: boolean
}

interface ComplianceSettings {
  gst_auto_calculation: boolean
  tds_enabled: boolean
  tcs_enabled: boolean
  audit_trail_mandatory: boolean
  stock_valuation_required_for_balance_sheet: boolean
}

interface CurrencySettings {
  default_currency: string
  allowed_currencies: string[]
  auto_fetch_exchange_rate: boolean
}

interface DiamondSettings {
  diamond_inventory_mode: 'separate' | 'hybrid' 
  valuation_method: 'packet_average' | 'individual' 
  certification_tracking_required: boolean
  allow_uncertified_sales: boolean
  max_uncertified_weight_cts: number
  diamond_loss_tracking_enabled: boolean
  diamond_breakage_threshold_percent: number
  default_diamond_currency: 'USD' | 'INR'
  enable_sieve_size_tracking: boolean
}

interface DocumentsConfig {
  bis_license_number: string
  invoice_terms_sales: string
  invoice_terms_repair: string
  invoice_footer_text: string
}

interface FinancialSettings {
  financial_year_start_month: string
  inventory_valuation_method: 'FIFO' | 'Weighted'
  default_tax_calculation_mode: 'inclusive' | 'exclusive'
  rounding_precision: string
  allow_negative_stock: boolean
  metal_rate_update_policy: 'manual' | 'auto-feed'
}

interface MetalDefaults {
  std_gold_purity_pct: number
  std_silver_purity_pct: number
  consider_making_charges_in_stock_value: boolean
  consider_stone_value_in_stock_value: boolean
}

interface RatePolicy {
  gold_rate_change_requires_approval: boolean
  allow_outlet_override: boolean
  max_manual_discount_percent: number
}

// --- Defaults ---
const defaultCompliance: ComplianceSettings = {
  gst_auto_calculation: true, tds_enabled: false, tcs_enabled: false, audit_trail_mandatory: true, stock_valuation_required_for_balance_sheet: false
}
const defaultCurrency: CurrencySettings = {
  default_currency: 'INR', allowed_currencies: ['INR'], auto_fetch_exchange_rate: false
}
const defaultDiamond: DiamondSettings = {
  diamond_inventory_mode: 'hybrid', valuation_method: 'packet_average', certification_tracking_required: true, allow_uncertified_sales: false, max_uncertified_weight_cts: 0.300, diamond_loss_tracking_enabled: true, diamond_breakage_threshold_percent: 2.00, default_diamond_currency: 'USD', enable_sieve_size_tracking: true
}
const defaultDocuments: DocumentsConfig = {
  bis_license_number: '', invoice_terms_sales: '', invoice_terms_repair: '', invoice_footer_text: ''
}
const defaultFinancial: FinancialSettings = {
  financial_year_start_month: '4', inventory_valuation_method: 'Weighted', default_tax_calculation_mode: 'exclusive', rounding_precision: '2', allow_negative_stock: false, metal_rate_update_policy: 'manual'
}
const defaultMetal: MetalDefaults = {
  std_gold_purity_pct: 99.50, std_silver_purity_pct: 99.90, consider_making_charges_in_stock_value: true, consider_stone_value_in_stock_value: true
}
const defaultRatePolicy: RatePolicy = {
  gold_rate_change_requires_approval: false, allow_outlet_override: false, max_manual_discount_percent: 0
}

export default function CompanyPage() {
  const router = useRouter()
  const { appUser, loading } = useAuth()
  
  // -- States --
  const [company, setCompany] = useState<any>(null)
  const [compliance, setCompliance] = useState<ComplianceSettings>(defaultCompliance)
  const [currency, setCurrency] = useState<CurrencySettings>(defaultCurrency)
  const [diamond, setDiamond] = useState<DiamondSettings>(defaultDiamond)
  const [documents, setDocuments] = useState<DocumentsConfig>(defaultDocuments)
  const [financial, setFinancial] = useState<FinancialSettings>(defaultFinancial)
  const [metal, setMetal] = useState<MetalDefaults>(defaultMetal)
  const [ratePolicy, setRatePolicy] = useState<RatePolicy>(defaultRatePolicy)
  const [addresses, setAddresses] = useState<CompanyAddress[]>([])
  const [taxRegistrations, setTaxRegistrations] = useState<TaxRegistration[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])

  // -- Load Data --
  useEffect(() => {
    if (!appUser?.company_id) return
    const loadAllData = async () => {
      const cid = appUser.company_id
      const { data: comp } = await supabase.from('companies').select('*').eq('id', cid).maybeSingle()
      if (comp) setCompany(comp)
      const { data: addr } = await supabase.from('company_addresses').select('*').eq('company_id', cid)
      if (addr) setAddresses(addr)
      const { data: tax } = await supabase.from('company_tax_registrations').select('*').eq('company_id', cid)
      if (tax) setTaxRegistrations(tax)
      const { data: bank } = await supabase.from('company_bank_accounts').select('*').eq('company_id', cid)
      if (bank) setBankAccounts(bank)
      const { data: compl } = await supabase.from('company_compliance_settings').select('*').eq('company_id', cid).maybeSingle()
      if (compl) setCompliance(compl)
      const { data: curr } = await supabase.from('company_currency_settings').select('*').eq('company_id', cid).maybeSingle()
      if (curr) setCurrency(curr)
      const { data: dia } = await supabase.from('company_diamond_settings').select('*').eq('company_id', cid).maybeSingle()
      if (dia) setDiamond(dia)
      const { data: doc } = await supabase.from('company_documents_config').select('*').eq('company_id', cid).maybeSingle()
      if (doc) setDocuments(doc)
      const { data: fin } = await supabase.from('company_financial_settings').select('*').eq('company_id', cid).maybeSingle()
      if (fin) setFinancial(fin)
      const { data: met } = await supabase.from('company_metal_defaults').select('*').eq('company_id', cid).maybeSingle()
      if (met) setMetal(met)
      const { data: rate } = await supabase.from('company_rate_policy').select('*').eq('company_id', cid).maybeSingle()
      if (rate) setRatePolicy(rate)
    }
    loadAllData()
  }, [appUser?.company_id])

  // -- Save Handler --
  const handleSaveSettings = async (tableName: string, data: any, label: string) => {
    if (!appUser?.company_id) return
    try {
      const payload = { ...data, company_id: appUser.company_id }
      const { error } = await supabase.from(tableName).upsert(payload, { onConflict: 'company_id' })
      if (error) throw error
      toast.success(`${label} saved successfully`)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  if (loading || !appUser) return <div className="h-screen flex items-center justify-center text-muted-foreground">Loading Company Settings...</div>

  return (
    <div className="min-h-screen bg-muted/40 pb-20">
      {/* --- Header --- */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b">
        <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate leading-none">
              {company?.legal_name || 'Company Settings'}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {company?.trade_name ? company.trade_name : 'System Configuration'}
            </p>
          </div>
        </div>
      </div>

      {/* --- Main Content --- */}
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="general" className="space-y-6">
          
          {/* Mobile Compatible Scrollable Tabs */}
          <div className="w-full overflow-x-auto pb-2 -mx-4 px-4 md:px-0">
            <TabsList className="inline-flex h-11 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground w-auto min-w-full md:w-full md:justify-center">
              <TabsTrigger value="general" className="px-4"><Building2 className="w-4 h-4 mr-2"/> <span className="whitespace-nowrap">General</span></TabsTrigger>
              <TabsTrigger value="financial" className="px-4"><Coins className="w-4 h-4 mr-2"/> <span className="whitespace-nowrap">Financial</span></TabsTrigger>
              <TabsTrigger value="inventory" className="px-4"><Gem className="w-4 h-4 mr-2"/> <span className="whitespace-nowrap">Inventory</span></TabsTrigger>
              <TabsTrigger value="policies" className="px-4"><ShieldCheck className="w-4 h-4 mr-2"/> <span className="whitespace-nowrap">Policies</span></TabsTrigger>
              <TabsTrigger value="documents" className="px-4"><FileText className="w-4 h-4 mr-2"/> <span className="whitespace-nowrap">Documents</span></TabsTrigger>
            </TabsList>
          </div>

          {/* --- TAB 1: GENERAL & LOCATIONS --- */}
          <TabsContent value="general" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Card>
              <CardHeader>
                <CardTitle>Organization Profile</CardTitle>
                <CardDescription>Legal details identifying your business.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                   <div className="space-y-2">
                     <Label>Legal Name</Label>
                     <Input value={company?.legal_name || ''} disabled className="bg-muted" />
                   </div>
                   <div className="space-y-2">
                     <Label>Trade Name</Label>
                     <Input value={company?.trade_name || ''} disabled className="bg-muted" />
                   </div>
                   <div className="space-y-2">
                     <Label>GSTIN</Label>
                     <Input value={company?.gstin || ''} disabled className="bg-muted" />
                   </div>
                   <div className="space-y-2">
                     <Label>PAN</Label>
                     <Input value={company?.pan_number || ''} disabled className="bg-muted" />
                   </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Address List */}
              <Card className="flex flex-col h-full">
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">Addresses</CardTitle>
                      <CardDescription>Locations & Warehouses</CardDescription>
                    </div>
                    <Button size="sm" variant="secondary"><Plus className="w-4 h-4 mr-2"/> Add</Button>
                 </CardHeader>
                 <CardContent className="pt-4 flex-1">
                    {addresses.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm border-dashed border rounded-lg">No addresses added</div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {addresses.map(a => (
                                    <TableRow key={a.id}>
                                        <TableCell className="font-medium">
                                          <div className="flex items-center">
                                            <MapPin className="w-3 h-3 mr-2 text-primary" />
                                            {a.address_type}
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          <div className="text-sm">{a.line1}</div>
                                          <div className="text-xs text-muted-foreground">{a.city}, {a.state}</div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                      </div>
                    )}
                 </CardContent>
              </Card>

              {/* Bank Accounts */}
              <Card className="flex flex-col h-full">
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">Banking</CardTitle>
                      <CardDescription>Company Accounts</CardDescription>
                    </div>
                    <Button size="sm" variant="secondary"><Plus className="w-4 h-4 mr-2"/> Add</Button>
                 </CardHeader>
                 <CardContent className="pt-4 flex-1">
                    {bankAccounts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm border-dashed border rounded-lg">No bank accounts</div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                            <TableHeader><TableRow><TableHead>Bank</TableHead><TableHead className="text-right">Details</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {bankAccounts.map(b => (
                                    <TableRow key={b.id}>
                                        <TableCell className="font-medium">
                                          <div className="flex items-center">
                                            <Landmark className="w-3 h-3 mr-2 text-primary" />
                                            {b.bank_name}
                                          </div>
                                          <div className="text-xs text-muted-foreground mt-0.5">{b.account_type}</div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                           <div className="text-sm font-mono">{b.account_number}</div>
                                           <div className="text-xs text-muted-foreground">{b.ifsc_code}</div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                      </div>
                    )}
                 </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* --- TAB 2: FINANCIAL --- */}
          <TabsContent value="financial" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle>Financial Configuration</CardTitle><CardDescription>Fiscal year and calculation logic</CardDescription></CardHeader>
                  <CardContent className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                         <div className="space-y-2">
                            <Label>FY Start Month</Label>
                            <Select value={String(financial.financial_year_start_month)} onValueChange={v => setFinancial({...financial, financial_year_start_month: v})}>
                               <SelectTrigger><SelectValue /></SelectTrigger>
                               <SelectContent>
                                   {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}
                               </SelectContent>
                            </Select>
                         </div>
                         <div className="space-y-2">
                            <Label>Inventory Valuation</Label>
                            <Select value={financial.inventory_valuation_method} onValueChange={(v:any) => setFinancial({...financial, inventory_valuation_method: v})}>
                               <SelectTrigger><SelectValue /></SelectTrigger>
                               <SelectContent>
                                   <SelectItem value="Weighted">Weighted Average</SelectItem>
                                   <SelectItem value="FIFO">FIFO</SelectItem>
                               </SelectContent>
                            </Select>
                         </div>
                      </div>
                      <div className="space-y-2">
                          <Label>Tax Calculation Mode</Label>
                          <Select value={financial.default_tax_calculation_mode} onValueChange={(v:any) => setFinancial({...financial, default_tax_calculation_mode: v})}>
                             <SelectTrigger><SelectValue /></SelectTrigger>
                             <SelectContent>
                                 <SelectItem value="exclusive">Tax Exclusive (Product Price + GST)</SelectItem>
                                 <SelectItem value="inclusive">Tax Inclusive (Price includes GST)</SelectItem>
                             </SelectContent>
                          </Select>
                      </div>
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                          <div className="space-y-0.5">
                            <Label className="text-base">Allow Negative Stock</Label>
                            <p className="text-xs text-muted-foreground">Continue billing even if stock is zero</p>
                          </div>
                          <Switch checked={financial.allow_negative_stock} onCheckedChange={c => setFinancial({...financial, allow_negative_stock: c})} />
                      </div>
                  </CardContent>
                  <CardFooter className="bg-muted/40 border-t p-4 flex justify-end">
                     <Button onClick={() => handleSaveSettings('company_financial_settings', financial, 'Financial Settings')}><Save className="w-4 h-4 mr-2"/> Save Changes</Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Compliance & Statutory</CardTitle><CardDescription>Taxation and regulatory toggles</CardDescription></CardHeader>
                  <CardContent className="space-y-6">
                      <div className="flex items-center justify-between p-1">
                          <div className="space-y-1">
                              <Label>GST Auto Calculation</Label>
                              <p className="text-xs text-muted-foreground">Automatically apply GST on sales</p>
                          </div>
                          <Switch checked={compliance.gst_auto_calculation} onCheckedChange={c => setCompliance({...compliance, gst_auto_calculation: c})} />
                      </div>
                      <div className="flex items-center justify-between p-1">
                          <div className="space-y-1">
                              <Label>TDS Enabled</Label>
                              <p className="text-xs text-muted-foreground">Enable Tax Deducted at Source</p>
                          </div>
                          <Switch checked={compliance.tds_enabled} onCheckedChange={c => setCompliance({...compliance, tds_enabled: c})} />
                      </div>
                      <div className="flex items-center justify-between p-1 opacity-70">
                          <div className="space-y-1">
                              <Label>Audit Trail (Mandatory)</Label>
                              <p className="text-xs text-muted-foreground">System enforced per MCA guidelines</p>
                          </div>
                          <Switch checked={compliance.audit_trail_mandatory} disabled />
                      </div>
                      
                      <div className="pt-4 border-t">
                        <Label className="mb-4 block">Active Registrations</Label>
                        {taxRegistrations.length === 0 ? <p className="text-xs text-muted-foreground italic">No Tax IDs configured</p> : (
                          <div className="flex flex-wrap gap-2">
                            {taxRegistrations.map(t => (
                              <span key={t.id} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80">
                                {t.registration_type}: {t.registration_number}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                  </CardContent>
                  <CardFooter className="bg-muted/40 border-t p-4 flex justify-end">
                     <Button onClick={() => handleSaveSettings('company_compliance_settings', compliance, 'Compliance')}><Save className="w-4 h-4 mr-2"/> Save Compliance</Button>
                  </CardFooter>
                </Card>
             </div>
          </TabsContent>

          {/* --- TAB 3: INVENTORY --- */}
          <TabsContent value="inventory" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                      <CardHeader><CardTitle>Metal Standards</CardTitle><CardDescription>Purity and calculation defaults</CardDescription></CardHeader>
                      <CardContent className="space-y-6">
                          <div className="grid grid-cols-2 gap-6">
                              <div className="space-y-2">
                                  <Label>Std Gold Purity (%)</Label>
                                  <Input type="number" value={metal.std_gold_purity_pct} onChange={e => setMetal({...metal, std_gold_purity_pct: parseFloat(e.target.value)})} />
                              </div>
                              <div className="space-y-2">
                                  <Label>Std Silver Purity (%)</Label>
                                  <Input type="number" value={metal.std_silver_purity_pct} onChange={e => setMetal({...metal, std_silver_purity_pct: parseFloat(e.target.value)})} />
                              </div>
                          </div>
                          <div className="space-y-4 pt-2">
                              <div className="flex items-center justify-between border-b pb-4">
                                  <Label>Include Making Charges in Stock Value</Label>
                                  <Switch checked={metal.consider_making_charges_in_stock_value} onCheckedChange={c => setMetal({...metal, consider_making_charges_in_stock_value: c})} />
                              </div>
                              <div className="flex items-center justify-between">
                                  <Label>Include Stone Value in Stock Value</Label>
                                  <Switch checked={metal.consider_stone_value_in_stock_value} onCheckedChange={c => setMetal({...metal, consider_stone_value_in_stock_value: c})} />
                              </div>
                          </div>
                      </CardContent>
                      <CardFooter className="bg-muted/40 border-t p-4 flex justify-end">
                          <Button onClick={() => handleSaveSettings('company_metal_defaults', metal, 'Metal Defaults')}><Save className="w-4 h-4 mr-2"/> Save Metal</Button>
                      </CardFooter>
                  </Card>

                  <Card>
                      <CardHeader><CardTitle>Diamond Configuration</CardTitle><CardDescription>Grading, valuation and tracking</CardDescription></CardHeader>
                      <CardContent className="space-y-6">
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                 <Label>Inventory Mode</Label>
                                 <Select value={diamond.diamond_inventory_mode} onValueChange={(v:any) => setDiamond({...diamond, diamond_inventory_mode: v})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="hybrid">Hybrid (Packets + Individual)</SelectItem><SelectItem value="separate">Separate Only</SelectItem></SelectContent>
                                 </Select>
                             </div>
                             <div className="space-y-2">
                                 <Label>Valuation Method</Label>
                                 <Select value={diamond.valuation_method} onValueChange={(v:any) => setDiamond({...diamond, valuation_method: v})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="packet_average">Packet Average</SelectItem><SelectItem value="individual">Individual Stone Value</SelectItem></SelectContent>
                                 </Select>
                             </div>
                           </div>
                           <div className="space-y-4 pt-2">
                              <div className="flex items-center justify-between border-b pb-4">
                                 <Label>Require Certification</Label>
                                 <Switch checked={diamond.certification_tracking_required} onCheckedChange={c => setDiamond({...diamond, certification_tracking_required: c})} />
                              </div>
                              <div className="flex items-center justify-between">
                                 <Label>Track Sieve Sizes</Label>
                                 <Switch checked={diamond.enable_sieve_size_tracking} onCheckedChange={c => setDiamond({...diamond, enable_sieve_size_tracking: c})} />
                              </div>
                           </div>
                      </CardContent>
                      <CardFooter className="bg-muted/40 border-t p-4 flex justify-end">
                          <Button onClick={() => handleSaveSettings('company_diamond_settings', diamond, 'Diamond Settings')}><Save className="w-4 h-4 mr-2"/> Save Diamond</Button>
                      </CardFooter>
                  </Card>
              </div>
          </TabsContent>

          {/* --- TAB 4: POLICIES --- */}
          <TabsContent value="policies" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   <Card>
                      <CardHeader><CardTitle>Sales & Discount Policy</CardTitle><CardDescription>Controls for sales staff</CardDescription></CardHeader>
                      <CardContent className="space-y-6">
                          <div className="flex items-center justify-between border p-3 rounded-lg">
                              <div className="space-y-0.5">
                                  <Label>Gold Rate Approval</Label>
                                  <p className="text-xs text-muted-foreground">Staff requires approval to change daily rates</p>
                              </div>
                              <Switch checked={ratePolicy.gold_rate_change_requires_approval} onCheckedChange={c => setRatePolicy({...ratePolicy, gold_rate_change_requires_approval: c})} />
                          </div>
                          <div className="flex items-center justify-between border p-3 rounded-lg">
                              <div className="space-y-0.5">
                                  <Label>Allow Outlet Override</Label>
                                  <p className="text-xs text-muted-foreground">Outlets can set their own rates vs HQ</p>
                              </div>
                              <Switch checked={ratePolicy.allow_outlet_override} onCheckedChange={c => setRatePolicy({...ratePolicy, allow_outlet_override: c})} />
                          </div>
                          <div className="space-y-2 pt-2">
                              <Label>Max Manual Discount (%)</Label>
                              <Input type="number" placeholder="0.00" value={ratePolicy.max_manual_discount_percent} onChange={e => setRatePolicy({...ratePolicy, max_manual_discount_percent: parseFloat(e.target.value)})} />
                              <p className="text-xs text-muted-foreground">Threshold before manager approval is needed</p>
                          </div>
                      </CardContent>
                      <CardFooter className="bg-muted/40 border-t p-4 flex justify-end">
                          <Button onClick={() => handleSaveSettings('company_rate_policy', ratePolicy, 'Rate Policy')}><Save className="w-4 h-4 mr-2"/> Save Policies</Button>
                      </CardFooter>
                   </Card>

                   <Card>
                      <CardHeader><CardTitle>Currency & Locale</CardTitle><CardDescription>Multi-currency handling</CardDescription></CardHeader>
                      <CardContent className="space-y-6">
                          <div className="space-y-2">
                               <Label>Base Currency</Label>
                               <Select value={currency.default_currency} onValueChange={v => setCurrency({...currency, default_currency: v})}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent><SelectItem value="INR">INR (₹)</SelectItem><SelectItem value="USD">USD ($)</SelectItem><SelectItem value="AED">AED</SelectItem></SelectContent>
                               </Select>
                          </div>
                          <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg">
                              <Label>Auto-fetch Exchange Rates</Label>
                              <Switch checked={currency.auto_fetch_exchange_rate} onCheckedChange={c => setCurrency({...currency, auto_fetch_exchange_rate: c})} />
                          </div>
                      </CardContent>
                      <CardFooter className="bg-muted/40 border-t p-4 flex justify-end">
                           <Button onClick={() => handleSaveSettings('company_currency_settings', currency, 'Currency')}><Save className="w-4 h-4 mr-2"/> Save Currency</Button>
                      </CardFooter>
                   </Card>
              </div>
          </TabsContent>

          {/* --- TAB 5: DOCUMENTS --- */}
          <TabsContent value="documents" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card>
                  <CardHeader><CardTitle>Legal & Printing</CardTitle><CardDescription>Terms displayed on customer receipts</CardDescription></CardHeader>
                  <CardContent className="space-y-6">
                      <div className="space-y-2 max-w-md">
                          <Label>BIS License Number</Label>
                          <Input value={documents.bis_license_number} onChange={e => setDocuments({...documents, bis_license_number: e.target.value})} placeholder="CM/L-xxxxxxx" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                              <Label>Invoice Terms (Sales)</Label>
                              <Textarea className="min-h-[120px]" value={documents.invoice_terms_sales} onChange={e => setDocuments({...documents, invoice_terms_sales: e.target.value})} placeholder="e.g. Goods once sold cannot be returned..." />
                          </div>
                          <div className="space-y-2">
                              <Label>Invoice Terms (Repairs)</Label>
                              <Textarea className="min-h-[120px]" value={documents.invoice_terms_repair} onChange={e => setDocuments({...documents, invoice_terms_repair: e.target.value})} placeholder="e.g. We are not responsible for stone breakage..." />
                          </div>
                      </div>
                      <div className="space-y-2">
                          <Label>Invoice Footer Text</Label>
                          <Input value={documents.invoice_footer_text} onChange={e => setDocuments({...documents, invoice_footer_text: e.target.value})} placeholder="Thank you for your business!" />
                      </div>
                  </CardContent>
                  <CardFooter className="bg-muted/40 border-t p-4 flex justify-end">
                      <Button onClick={() => handleSaveSettings('company_documents_config', documents, 'Documents Config')}><Save className="w-4 h-4 mr-2"/> Save Documents</Button>
                  </CardFooter>
              </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  )
}