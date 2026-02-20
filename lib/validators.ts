import { z } from 'zod'

// Company Schema
export const companySchema = z.object({
  legal_name: z.string().min(1, 'Legal name is required'),
  trade_name: z.string().optional(),
  company_code: z.string().min(1, 'Company code is required'),
  pan_number: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').optional(),
  cin_number: z.string().optional(),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format').optional(),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
})

// Warehouse Schema
export const warehouseSchema = z.object({
  warehouse_code: z.string().min(1, 'Warehouse code is required'),
  name: z.string().min(1, 'Warehouse name is required'),
  warehouse_type: z.enum(['main_safe', 'factory', 'branch', 'transit']),
  is_active: z.boolean().default(true),
})

// Address Schema
export const addressSchema = z.object({
  address_type: z.enum(['Registered', 'Billing', 'Corporate', 'Warehouse']),
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  country: z.string().default('India'),
  pincode: z.string().regex(/^[0-9]{6}$/, 'Invalid pincode'),
})

// Gold Batch Schema
export const goldBatchSchema = z.object({
  batch_number: z.string().min(1, 'Batch number is required'),
  purity_karat: z.string().min(1, 'Purity is required'),
  purity_percent: z.number().min(0).max(100),
  total_weight_g: z.number().positive('Weight must be greater than 0'),
  purchase_rate_per_g: z.number().positive('Rate must be greater than 0'),
  warehouse_id: z.string().uuid('Invalid warehouse'),
})

// Diamond Lot Schema
export const diamondLotSchema = z.object({
  lot_number: z.string().min(1, 'Lot number is required'),
  lot_type: z.string().min(1, 'Lot type is required'),
  total_weight_cts: z.number().positive('Weight must be greater than 0'),
  total_pieces: z.number().int().positive('Pieces must be greater than 0').optional(),
  purchase_rate_per_ct: z.number().positive('Rate must be greater than 0'),
  warehouse_id: z.string().uuid('Invalid warehouse'),
  certificate_number: z.string().optional(),
  certificate_agency: z.string().optional(),
})

// Customer Schema
export const customerSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  phone: z.string().regex(/^[0-9]{10}$/, 'Invalid phone number'),
  email: z.string().email('Invalid email').optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
})

// Job Bag Schema
export const jobBagSchema = z.object({
  job_bag_number: z.string().min(1, 'Job bag number is required'),
  product_category: z.string().min(1, 'Product category is required'),
  design_code: z.string().optional(),
  karigar_id: z.string().uuid('Invalid karigar'),
  gold_expected_weight_g: z.number().positive().optional(),
  diamond_expected_weight_cts: z.number().positive().optional(),
  expected_return_date: z.string().datetime().optional(),
})

// Transfer Schema
export const transferSchema = z.object({
  transfer_number: z.string().min(1, 'Transfer number is required'),
  from_warehouse_id: z.string().uuid('Invalid warehouse'),
  to_warehouse_id: z.string().uuid('Invalid warehouse'),
  notes: z.string().optional(),
})

// Bank Account Schema
export const bankAccountSchema = z.object({
  bank_name: z.string().min(1, 'Bank name is required'),
  account_name: z.string().min(1, 'Account name is required'),
  account_number: z.string().min(1, 'Account number is required'),
  ifsc_code: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code'),
  branch_name: z.string().optional(),
  account_type: z.enum(['CURRENT', 'SAVINGS', 'CC', 'OD']).default('CURRENT'),
})

// Type exports for form state
export type CompanyFormData = z.infer<typeof companySchema>
export type WarehouseFormData = z.infer<typeof warehouseSchema>
export type AddressFormData = z.infer<typeof addressSchema>
export type GoldBatchFormData = z.infer<typeof goldBatchSchema>
export type DiamondLotFormData = z.infer<typeof diamondLotSchema>
export type CustomerFormData = z.infer<typeof customerSchema>
export type JobBagFormData = z.infer<typeof jobBagSchema>
export type TransferFormData = z.infer<typeof transferSchema>
export type BankAccountFormData = z.infer<typeof bankAccountSchema>
