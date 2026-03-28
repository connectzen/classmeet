import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiResponse, apiError, ApiError } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('slug')

    if (!slug) {
      throw new ApiError('Slug parameter is required', 400)
    }

    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    if (!slugRegex.test(slug)) {
      return apiResponse({ available: false, reason: 'Invalid format' })
    }

    const supabase = createAdminClient()
    const { data } = await supabase
      .from('schools')
      .select('id')
      .eq('slug', slug)
      .single()

    return apiResponse({ available: !data })
  } catch (error) {
    return apiError(error)
  }
}
