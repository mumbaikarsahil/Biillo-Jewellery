'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'

interface RpcError {
  code: string
  message: string
  details?: string
}

interface RpcResult<T> {
  data: T | null
  error: RpcError | null
  loading: boolean
}

export function useRpc<T = any>() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<RpcError | null>(null)

  const callRpc = async (
    functionName: string,
    params: Record<string, any>
  ): Promise<RpcResult<T>> => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc(functionName, params)

      if (rpcError) {
        const err: RpcError = {
          code: rpcError.code,
          message: rpcError.message,
          details: rpcError.details,
        }
        setError(err)
        toast({
          title: 'Error',
          description: err.message,
          variant: 'destructive',
        })
        return { data: null, error: err, loading: false }
      }

      toast({
        title: 'Success',
        description: `${functionName} completed successfully`,
      })

      return { data: data as T, error: null, loading: false }
    } catch (err) {
      const error: RpcError = {
        code: 'UNKNOWN_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error occurred',
      }
      setError(error)
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
      return { data: null, error, loading: false }
    } finally {
      setLoading(false)
    }
  }

  return { callRpc, loading, error }
}
