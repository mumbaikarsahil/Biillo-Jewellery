'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, UploadCloud, Image as ImageIcon, FileText, Stamp } from 'lucide-react'

export default function InvoiceSettingsPage() {
  const { appUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Settings State
  const [bannerUrl, setBannerUrl] = useState('')
  const [disclaimer, setDisclaimer] = useState('')
  const [showStamp, setShowStamp] = useState(true)

  // Default Fallback Disclaimer
  const defaultDisclaimer = "We hereby certify that my/our registration certificate under the Maharashtra Value Added Tax Act 2002 is in force on the date on which the sale of the goods specified in this Tax Invoice is made by me/us..."

  useEffect(() => {
    async function fetchSettings() {
      if (!appUser?.company_id) return
      
      try {
        const { data, error } = await supabase
          .from('company_settings')
          .select('*')
          .eq('company_id', appUser.company_id)
          .maybeSingle()

        if (error) throw error

        if (data) {
          setBannerUrl(data.invoice_banner_url || '')
          setDisclaimer(data.invoice_disclaimer || defaultDisclaimer)
          setShowStamp(data.show_exchange_stamp ?? true)
        } else {
          setDisclaimer(defaultDisclaimer)
        }
      } catch (err: any) {
        toast.error('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [appUser])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)
      if (!e.target.files || e.target.files.length === 0) return
      
      const file = e.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `banner-${appUser?.company_id}-${Date.now()}.${fileExt}`
      const filePath = `invoice-banners/${fileName}`

      // Upload to 'brand-assets' bucket
      const { error: uploadError } = await supabase.storage
        .from('brand-assets')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get Public URL
      const { data } = supabase.storage.from('brand-assets').getPublicUrl(filePath)
      
      setBannerUrl(data.publicUrl)
      toast.success('Image uploaded successfully! Remember to save.')
    } catch (error: any) {
      toast.error('Error uploading image: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!appUser?.company_id) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('company_settings')
        .upsert({
          company_id: appUser.company_id,
          invoice_banner_url: bannerUrl,
          invoice_disclaimer: disclaimer,
          show_exchange_stamp: showStamp,
          updated_at: new Date().toISOString()
        })

      if (error) throw error
      toast.success('Invoice settings updated successfully!')
    } catch (err: any) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Invoice Settings</h1>
        <p className="text-slate-500">Manage the look, feel, and legal text of your printed bills.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        
        {/* Left Column: Visual Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ImageIcon className="h-5 w-5 text-[#B254A3]" />
                Promotional Footer Banner
              </CardTitle>
              <CardDescription>Upload a 1920x600px image to display at the bottom of the invoice.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Image Preview */}
              <div className="w-full h-32 bg-slate-100 rounded-lg border border-dashed border-slate-300 overflow-hidden relative flex items-center justify-center">
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                ) : (
                  <p className="text-xs text-slate-400 font-medium">No banner uploaded</p>
                )}
              </div>

              <div className="flex items-center gap-4">
                <Input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  disabled={uploading}
                  className="cursor-pointer file:text-[#B254A3] file:bg-pink-50 file:border-0 file:rounded-md file:px-4 file:py-1 file:mr-4 file:font-semibold"
                />
                {uploading && <Loader2 className="h-5 w-5 animate-spin text-[#B254A3]" />}
              </div>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Recommended Ratio: 3.2 : 1 (e.g., 1920 x 600 px)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Stamp className="h-5 w-5 text-[#B254A3]" />
                Trust & Branding Elements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">100% Exchange Stamp</Label>
                  <p className="text-sm text-slate-500">Show the exchange guarantee stamp above the signature line.</p>
                </div>
                <Switch checked={showStamp} onCheckedChange={setShowStamp} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Text Settings */}
        <div className="space-y-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-[#B254A3]" />
                Legal Terms & Conditions
              </CardTitle>
              <CardDescription>This text prints in the tiny font just above the banner.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea 
                value={disclaimer}
                onChange={(e) => setDisclaimer(e.target.value)}
                className="min-h-[300px] text-xs resize-none"
                placeholder="Enter your terms and conditions..."
              />
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Save Action */}
      <div className="flex justify-end pt-4 border-t border-slate-200">
        <Button 
          onClick={handleSave} 
          disabled={saving} 
          className="bg-[#B254A3] hover:bg-[#8E3B71] text-white px-8"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Save Invoice Settings'}
        </Button>
      </div>

    </div>
  )
}