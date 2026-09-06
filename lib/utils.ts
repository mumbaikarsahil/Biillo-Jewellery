import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateNetWeight(grossWeightGrams: number, diamondCarats: number = 0): number {
  if (!grossWeightGrams || grossWeightGrams <= 0) return 0;
  
  // 1 Carat = 0.2 Grams
  const diamondWeightGrams = diamondCarats * 0.2;
  const netWeight = grossWeightGrams - diamondWeightGrams;
  
  // Ensure it doesn't go negative and format to 3 decimal places
  return Math.max(0, Number(netWeight.toFixed(3)));
}

// lib/utils.ts  (or add to the top of your widget files)

export const downloadCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) return;

  // Smart flattener for nested Supabase objects (e.g. customers.full_name)
  const flattenObject = (obj: any, prefix = ''): any => {
    return Object.keys(obj).reduce((acc: any, k: string) => {
      const pre = prefix.length ? prefix + '_' : '';
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        Object.assign(acc, flattenObject(obj[k], pre + k));
      } else if (Array.isArray(obj[k])) {
        // If it's an array of objects (like multiple gifts), stringify it safely
        acc[pre + k] = obj[k].map(i => typeof i === 'object' ? (i.name || i.full_name || 'Item') : i).join(' | ');
      } else {
        acc[pre + k] = obj[k];
      }
      return acc;
    }, {});
  };

  const flattenedData = data.map(item => flattenObject(item));
  const headers = Array.from(new Set(flattenedData.flatMap(Object.keys)));
  
  const csvRows = flattenedData.map(row => 
    headers.map(fieldName => {
      let val = row[fieldName] === null || row[fieldName] === undefined ? '' : row[fieldName];
      // Escape quotes and wrap in quotes for CSV safety
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',')
  );
  
  csvRows.unshift(headers.join(',')); // Add header row
  const csvString = csvRows.join('\n');
  
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};