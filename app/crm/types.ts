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
  address?: string | null
  pan_no?: string | null
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
  voucher_call_assignments?: any[];
  // Array Relations
  kitty_plans?: KittyPlan[] 
  vouchers?: any[]
  
  // Strongly Typed Sequences & Webhooks
  voucher_message_sequences?: Array<{
    id: string
    status: string
  }>
  crm_webhook_events?: Array<{
    id: string
    message: string
    workflow: string;
    event_time: string
    processed_status: string
  }>
}

export interface Warehouse {
  id: string
  name: string
}