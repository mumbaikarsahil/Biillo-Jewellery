// app/crm/types.ts
export interface CRMCustomer {
    id: string
    full_name: string
    phone: string
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
    kitty_plan_name?: string
    kitty_plan_status?: string
    kitty_installment_amount?: number
    kitty_months_paid?: number
    kitty_payment_ledger?: any[]
  }
  
  export interface Warehouse {
    id: string
    name: string
  }