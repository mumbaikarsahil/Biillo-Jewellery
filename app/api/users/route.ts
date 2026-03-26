import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Initialize Supabase with the SERVICE ROLE KEY to bypass RLS and Auth rules
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, full_name, role, warehouse_id } = body

    // 1. Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for internal ERP users
    })

    if (authError) throw authError

    // 2. Create the user's profile in our public.profiles table
    if (authData.user) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert([
          {
            id: authData.user.id,
            email,
            full_name,
            role,
            warehouse_id: warehouse_id || null, // null if it's main office
          }
        ])

      if (profileError) {
        // Rollback auth user if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        throw profileError
      }
    }

    return NextResponse.json({ success: true, user: authData.user })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, password, full_name, role, warehouse_id, is_active } = body

    // 1. Update Profile Information
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ full_name, role, warehouse_id, is_active })
      .eq('id', id)

    if (profileError) throw profileError

    // 2. Update Auth Password (Only if a new password was typed in)
    if (password && password.trim() !== '') {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: password
      })
      if (authError) throw authError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}