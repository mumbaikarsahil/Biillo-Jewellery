import { supabase } from './supabaseClient'

/**
 * RPC Wrapper for critical ERP operations
 * All these operations must be called from verified server contexts
 */

export interface RpcResponse<T> {
  data: T | null
  error: string | null
}

/**
 * Dispatch a stock transfer - marks items as in transit
 * SECURITY: Must validate user_id and transfer ownership in RPC
 */
export async function dispatchStockTransfer(
  transferId: string,
  userId: string
): Promise<RpcResponse<any>> {
  try {
    const { data, error } = await supabase.rpc('dispatch_stock_transfer', {
      p_transfer_id: transferId,
      p_user_id: userId,
    })

    if (error) {
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Receive a single item in transfer
 * SECURITY: Must validate user has receive permissions
 */
export async function receiveStockTransferItem(
  transferId: string,
  itemId: string,
  userId: string
): Promise<RpcResponse<{ completed: boolean }>> {
  try {
    const { data, error } = await supabase.rpc(
      'receive_stock_transfer_item',
      {
        p_transfer_id: transferId,
        p_item_id: itemId,
        p_user_id: userId,
      }
    )

    if (error) {
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Finalize transfer with discrepancy handling
 * SECURITY: Verify user role is manager or above
 */
export async function finalizeTransferWithDiscrepancy(
  transferId: string,
  markMissing: boolean,
  userId: string
): Promise<RpcResponse<any>> {
  try {
    const { data, error } = await supabase.rpc(
      'finalize_transfer_with_discrepancy',
      {
        p_transfer_id: transferId,
        p_mark_missing: markMissing,
        p_user_id: userId,
      }
    )

    if (error) {
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Close job bag and create inventory item
 * SECURITY: Validate job bag ownership and user permissions
 */
export async function closeJobBagAndCreateItem(
  jobBagId: string,
  grossWeightG: number,
  netWeightG: number,
  stoneWeight: number,
  mrp: number,
  huIdCode: string | null,
  hsnCode: string | null,
  userId: string
): Promise<RpcResponse<{ itemId: string }>> {
  try {
    const { data, error } = await supabase.rpc(
      'close_job_bag_and_create_item',
      {
        p_job_bag_id: jobBagId,
        p_gross_weight_g: grossWeightG,
        p_net_weight_g: netWeightG,
        p_stone_weight: stoneWeight,
        p_mrp: mrp,
        p_huid_code: huIdCode,
        p_hsn_code: hsnCode,
        p_user_id: userId,
      }
    )

    if (error) {
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Confirm sale and create invoice
 * SECURITY: Must run in transaction, validate items belong to company
 */
export async function posConfirmSale(
  invoiceJson: {
    customer_id: string
    items: Array<{ item_id: string; rate: number }>
    payment_mode: string
  },
  userId: string
): Promise<RpcResponse<{ invoiceId: string; invoiceNumber: string }>> {
  try {
    const { data, error } = await supabase.rpc('pos_confirm_sale', {
      p_invoice_json: invoiceJson,
      p_user_id: userId,
    })

    if (error) {
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Convert memo transaction to sale or return
 * SECURITY: Verify memo ownership and status
 */
export async function convertMemoTransaction(
  memoId: string,
  action: 'to_sale' | 'to_return',
  userId: string
): Promise<RpcResponse<{ transactionId: string }>> {
  try {
    const { data, error } = await supabase.rpc(
      'convert_memo_transaction',
      {
        p_memo_id: memoId,
        p_action: action,
        p_user_id: userId,
      }
    )

    if (error) {
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Complete sales return and process refund
 * SECURITY: Validate return items belong to original invoice
 */
export async function completeSalesReturn(
  returnId: string,
  userId: string
): Promise<RpcResponse<{ refundId: string }>> {
  try {
    const { data, error } = await supabase.rpc('complete_sales_return', {
      p_return_id: returnId,
      p_user_id: userId,
    })

    if (error) {
      return { data: null, error: error.message }
    }

    return { data, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
