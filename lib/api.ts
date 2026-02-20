import { supabase } from './supabaseClient'

// Fetch companies for a user
export async function fetchCompanies(userId: string) {
  return await supabase
    .from('app_users')
    .select('company_id, companies(id, legal_name, trade_name, company_code)')
    .eq('user_id', userId)
}

// Fetch warehouses for a company
export async function fetchWarehouses(companyId: string) {
  return await supabase
    .from('warehouses')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
}

// Fetch inventory items with filters
export async function fetchInventoryItems(
  companyId: string,
  filters?: {
    warehouse_id?: string
    status?: string
    metal_type?: string
  }
) {
  let query = supabase
    .from('inventory_items')
    .select('*')
    .eq('company_id', companyId)

  if (filters?.warehouse_id) {
    query = query.eq('warehouse_id', filters.warehouse_id)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.metal_type) {
    query = query.eq('metal_type', filters.metal_type)
  }

  return await query
}

// Fetch stock transfers
export async function fetchStockTransfers(
  companyId: string,
  status?: string
) {
  let query = supabase
    .from('stock_transfers')
    .select('*')
    .eq('company_id', companyId)

  if (status) {
    query = query.eq('status', status)
  }

  return await query.order('created_at', { ascending: false })
}

// Fetch job bags
export async function fetchJobBags(companyId: string) {
  return await supabase
    .from('job_bags')
    .select('*, karigars(full_name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
}

// Fetch customers
export async function fetchCustomers(companyId: string) {
  return await supabase
    .from('customers')
    .select('*')
    .eq('company_id', companyId)
    .order('full_name')
}

// Create stock transfer
export async function createStockTransfer(
  companyId: string,
  data: {
    transfer_number: string
    from_warehouse_id: string
    to_warehouse_id: string
    notes?: string
  }
) {
  return await supabase.from('stock_transfers').insert({
    company_id: companyId,
    status: 'draft',
    ...data,
  })
}

// Add item to transfer
export async function addItemToTransfer(
  transferId: string,
  itemId: string
) {
  return await supabase.from('stock_transfer_item_lines').insert({
    transfer_id: transferId,
    item_id: itemId,
    is_received: false,
  })
}

// Fetch transfer detail
export async function fetchTransferDetail(transferId: string) {
  const { data: transfer, error: transferError } = await supabase
    .from('stock_transfers')
    .select('*')
    .eq('id', transferId)
    .maybeSingle()

  if (transferError || !transfer) {
    throw new Error('Transfer not found')
  }

  const { data: items } = await supabase
    .from('stock_transfer_item_lines')
    .select('*, inventory_items(barcode, sku_reference, metal_type)')
    .eq('transfer_id', transferId)

  return { transfer, items }
}

// Fetch dashboard data
export async function fetchDashboardData(
  companyId: string,
  views: string[]
) {
  const results: Record<string, any> = {}

  for (const view of views) {
    const { data } = await supabase.rpc(`v_${view}`, {
      p_company_id: companyId,
    })
    results[view] = data
  }

  return results
}

// Fetch customers list
export async function fetchCustomersList(companyId: string, search?: string) {
  let query = supabase
    .from('customers')
    .select('id, full_name, phone, email')
    .eq('company_id', companyId)

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  return await query.limit(20)
}

// Create customer
export async function createCustomer(
  companyId: string,
  data: {
    full_name: string
    phone: string
    email?: string
    city?: string
    notes?: string
  }
) {
  return await supabase.from('customers').insert({
    company_id: companyId,
    ...data,
  })
}
