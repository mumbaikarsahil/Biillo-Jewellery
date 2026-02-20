export type JobBag = {
    id: string
    job_bag_number: string
    product_category: string | null
    design_code: string | null
    gold_expected_weight_g: number | null
    diamond_expected_weight_cts: number | null
    status: 'open' | 'issued' | 'in_progress' | 'completed' | 'closed'
    issue_date: string | null
    expected_return_date: string | null
    karigar_id: string
  }
  
  export type GoldBatch = {
    id: string
    batch_number: string
    purity_karat: string
    remaining_weight_g: number
    purchase_rate_per_g: number
  }
  
  export type DiamondLot = {
    id: string
    lot_number: string
    remaining_weight_cts: number
    remaining_pieces: number
    purchase_rate_per_ct: number
  }
  
  export type GoldIssue = {
    id: string
    gold_batch_id: string
    issued_weight_g: number
    created_at: string
  }
  
  export type DiamondIssue = {
    id: string
    diamond_lot_id: string
    issued_weight_cts: number
    issued_pieces: number
    created_at: string
  }
  