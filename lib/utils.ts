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