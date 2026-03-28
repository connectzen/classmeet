import { requireSuperAdmin } from '@/lib/api-utils'
import { apiResponse, apiError } from '@/lib/api-utils'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'super_admin_email')
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is okay
      throw error
    }

    return apiResponse({ superAdminEmail: data?.setting_value?.email || null })
  } catch (err) {
    return apiError(err)
  }
}

export async function POST(request: Request) {
  try {
    await requireSuperAdmin(request)
    const supabase = await createClient()
    const { email } = await request.json()

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return apiError('Invalid email format', 400)
    }

    // Upsert super admin email
    const { data, error } = await (supabase as any)
      .from('system_settings')
      .upsert(
        {
          setting_key: 'super_admin_email',
          setting_value: { email: email.toLowerCase() },
          description: 'Email address of the system super admin',
        },
        { onConflict: 'setting_key' }
      )
      .select()
      .single()

    if (error) throw error

    return apiResponse({ superAdminEmail: data?.setting_value?.email })
  } catch (err) {
    return apiError(err)
  }
}
