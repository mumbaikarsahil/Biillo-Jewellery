"use client"

import React, { useState, useRef, useMemo } from 'react'
import Papa from 'papaparse'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { 
  UploadCloud, Download, FileSpreadsheet, CheckCircle2, 
  AlertTriangle, Loader2, ChevronLeft, ChevronRight, XCircle, Play,
  ArrowRight
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import {
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow
} from '@/components/ui/table'

// ── TYPES & INTERFACES ──
interface ParsedRow {
  code: string;
  name: string;
  phone: string;
  email: string;
  branch: string;
  dob: string;
  anniversary: string;
}

interface ProcessResult {
  row: ParsedRow;
  status: 'success' | 'failed';
  error?: string;
}

export default function BulkVoucherUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<ParsedRow[]>([])
  
  // UI States
  const [step, setStep] = useState<1 | 2 | 3>(1) // 1: Upload, 2: Preview, 3: Processing/Results
  const [isParsing, setIsParsing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // Pagination
  const [page, setPage] = useState(1)
  const pageSize = 15
  
  // Batch Processing Tracking
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<ProcessResult[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── 1. DEMO CSV GENERATOR ──
  const handleDownloadDemo = () => {
    const csvContent = "code,name,phone,email,branch,dob,anniversary\nVCH1001,Amit Sharma,9876543210,amit@test.com,Andheri,1990-05-15,2015-12-01\nVCH1002,Priya Singh,9123456789,priya@test.com,Borivali,1992-08-20,\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "Pavitram_Bulk_Voucher_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── 2. FILE PARSING ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  }

  const handleParseCSV = () => {
    if (!file) return toast.error("Please select a CSV file first.");
    setIsParsing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rawRows = results.data as any[];
          
          // Map and validate rows
          const mappedData: ParsedRow[] = rawRows
            .filter(row => row.code && row.phone) // Essential fields
            .map(row => ({
               code: String(row.code).toUpperCase().trim(),
               name: String(row.name || 'Unknown').trim(),
               phone: String(row.phone).replace(/\D/g, '').slice(-10), // Clean phone
               email: String(row.email || '').trim(),
               branch: String(row.branch || 'Unassigned').trim(),
               dob: String(row.dob || '').trim(),
               anniversary: String(row.anniversary || '').trim()
            }));

          if (mappedData.length === 0) throw new Error("No valid rows found. Ensure 'code' and 'phone' columns exist.");
          
          setPreviewData(mappedData);
          setStep(2);
          toast.success(`Successfully loaded ${mappedData.length} records.`);
        } catch (err: any) {
          toast.error(`Parsing Error: ${err.message}`);
        } finally {
          setIsParsing(false);
        }
      },
      error: (error) => {
        toast.error(`CSV Error: ${error.message}`);
        setIsParsing(false);
      }
    });
  };

  // ── 3. BATCH PROCESSING ENGINE ──
  const executeBulkUpload = async () => {
    setStep(3);
    setIsProcessing(true);
    setProgress(0);
    setResults([]);

    const batchSize = 20; // Safe limit for Supabase RPC loops
    const totalRecords = previewData.length;
    let completed = 0;
    const allResults: ProcessResult[] = [];

    // Loop through data in chunks
    for (let i = 0; i < totalRecords; i += batchSize) {
      const batch = previewData.slice(i, i + batchSize);
      
      // Process chunk concurrently
      const batchPromises = batch.map(async (row) => {
        try {
          // 1. Call your existing RPC
          const { error } = await supabase.rpc('register_voucher_public', {
            p_code: row.code,
            p_name: row.name,
            p_phone: row.phone,
            p_branch: row.branch,
            p_email: row.email || null,
            p_dob: row.dob || null,
            p_anniversary: row.anniversary || null
          });

          if (error) throw error;

          // Note: To prevent WhatsApp ban risk from blasting 1000 messages instantly, 
          // we skip the WhatsApp API trigger here. You can broadcast them later via CRM.

          return { row, status: 'success' as const };
        } catch (err: any) {
          return { row, status: 'failed' as const, error: err.message || 'Unknown error' };
        }
      });

      // Wait for the current batch to finish
      const batchOutcomes = await Promise.all(batchPromises);
      allResults.push(...batchOutcomes);
      
      // Update Progress UI
      completed += batch.length;
      setProgress(Math.round((completed / totalRecords) * 100));
      setResults([...allResults]);

      // Small delay between batches to respect rate limits
      await new Promise(res => setTimeout(res, 300));
    }

    setIsProcessing(false);
    toast.success("Bulk processing completed!");
  };

  // ── 4. ERROR EXPORT ──
  const downloadErrorLog = () => {
    const failedRows = results.filter(r => r.status === 'failed');
    if (failedRows.length === 0) return;

    const csvContent = [
      "Code,Name,Phone,Error Reason",
      ...failedRows.map(r => `"${r.row.code}","${r.row.name}","${r.row.phone}","${r.error?.replace(/"/g, '""')}"`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Voucher_Failures_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  // ── PAGINATION HELPERS ──
  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return previewData.slice(startIndex, startIndex + pageSize);
  }, [previewData, page]);

  const totalPages = Math.ceil(previewData.length / pageSize);

  const successCount = results.filter(r => r.status === 'success').length;
  const failCount = results.filter(r => r.status === 'failed').length;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans selection:bg-indigo-100">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bulk Voucher Registration</h1>
            <p className="text-sm text-slate-500 mt-1">Upload a CSV to claim and assign multiple vouchers simultaneously.</p>
          </div>
          <Button variant="outline" onClick={handleDownloadDemo} className="bg-white border-slate-200 text-slate-600 shadow-sm">
            <Download className="w-4 h-4 mr-2" /> Download Demo CSV
          </Button>
        </div>

        {/* STEP 1: UPLOAD */}
        {step === 1 && (
          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden animate-in fade-in">
            <CardContent className="p-10 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl m-6 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <div className="w-16 h-16 bg-white border border-slate-200 rounded-full flex items-center justify-center mb-4 shadow-sm">
                <FileSpreadsheet className="w-8 h-8 text-indigo-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-2">Upload your data file</h3>
              <p className="text-sm text-slate-500 mb-6 text-center max-w-sm">
                CSV must include <code className="bg-slate-200 px-1 py-0.5 rounded text-xs text-slate-800">code</code> and <code className="bg-slate-200 px-1 py-0.5 rounded text-xs text-slate-800">phone</code> columns. Dates should be in YYYY-MM-DD format.
              </p>
              
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
              />
              
              <div className="flex gap-3">
                <Button 
                  variant={file ? "outline" : "default"} 
                  onClick={() => fileInputRef.current?.click()}
                  className={!file ? "bg-indigo-600 hover:bg-indigo-700" : "bg-white"}
                >
                  <UploadCloud className="w-4 h-4 mr-2" /> {file ? "Change File" : "Select CSV File"}
                </Button>
                
                {file && (
                  <Button onClick={handleParseCSV} disabled={isParsing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {isParsing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                    Parse & Preview
                  </Button>
                )}
              </div>
              
              {file && <p className="text-xs font-medium text-slate-500 mt-4">Selected: {file.name}</p>}
            </CardContent>
          </Card>
        )}

        {/* STEP 2: PREVIEW */}
        {step === 2 && (
          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-800">Data Preview</CardTitle>
                <CardDescription>Verified {previewData.length} valid rows from the upload.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setStep(1); setFile(null); }} className="text-slate-500">Cancel</Button>
                <Button onClick={executeBulkUpload} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                  Start Bulk Claim <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="text-xs font-bold text-slate-500">Voucher Code</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">Customer Name</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">Phone</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">Branch</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">DOB</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs font-bold text-slate-900">{row.code}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-700">{row.name}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-600">{row.phone}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-600">{row.branch}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-600">{row.dob || '--'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs font-medium text-slate-500">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, previewData.length)} of {previewData.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1} className="h-8">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs font-bold text-slate-700 w-12 text-center">Pg {page}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="h-8">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: PROCESSING & RESULTS */}
        {step === 3 && (
          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <CardContent className="p-8 space-y-8">
              
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">
                  {isProcessing ? "Processing Data..." : "Job Completed"}
                </h2>
                <p className="text-slate-500 text-sm">
                  {isProcessing 
                    ? `Claiming vouchers in batches. Please do not close this window. (${results.length} / ${previewData.length})` 
                    : `Finished processing ${previewData.length} records.`}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2 max-w-xl mx-auto">
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-3 bg-slate-100" />
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 gap-4 max-w-xl mx-auto">
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                  <p className="text-2xl font-black text-emerald-700">{successCount}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-600/70 mt-1">Successful</p>
                </div>
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-center">
                  <XCircle className="w-6 h-6 text-rose-500 mx-auto mb-2" />
                  <p className="text-2xl font-black text-rose-700">{failCount}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-rose-600/70 mt-1">Failed</p>
                </div>
              </div>

              {/* Final Actions */}
              {!isProcessing && (
                <div className="flex justify-center gap-4 pt-4">
                  {failCount > 0 && (
                    <Button onClick={downloadErrorLog} variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50 font-bold shadow-sm">
                      <AlertTriangle className="w-4 h-4 mr-2" /> Download Error Log
                    </Button>
                  )}
                  <Button onClick={() => { setStep(1); setFile(null); setPreviewData([]); }} className="bg-slate-900 text-white shadow-sm">
                    Upload Another Batch
                  </Button>
                </div>
              )}

            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}