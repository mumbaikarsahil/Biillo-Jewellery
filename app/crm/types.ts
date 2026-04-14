// app/crm/types.ts

export interface KittyPlan {
  id: string
  plan_name: string
  plan_amount: number
  total_months: number
  months_paid: number
  status: string
  start_date: string
}

export interface CRMCustomer {
  id: string
  full_name: string
  phone: string
  email?: string | null
  city: string | null
  customer_status: string 
  next_followup_date: string | null
  followup_reason: string | null 
  last_interaction: string | null
  created_at: string
  birth_date?: string
  anniversary_date?: string
  warehouse_id?: string
  store_credit_balance?: number
  pavitram_points?: number
  
  // NEW: An array of active or past plans instead of flat fields
  kitty_plans?: KittyPlan[] 
}

export interface Warehouse {
  id: string
  name: string
}