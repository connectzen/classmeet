import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiResponse, apiError } from '@/lib/api-utils'

/**
 * POST /api/profile/avatar
 * Body: FormData with field "file" (image)
 *
 * Uploads via the admin storage client so bucket policies don't block it.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiError('Unauthorized', 401)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return apiError('No file provided', 400)
    if (!file.type.startsWith('image/')) return apiError('Only image files are allowed', 400)
    if (file.size > 5 * 1024 * 1024) return apiError('File too large (max 5 MB)', 400)

    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/avatar.${ext}`

    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const admin = createAdminClient()
    const { error: uploadErr } = await admin.storage
      .from('avatars')
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadErr) return apiError(uploadErr.message, 500)

    const { data } = admin.storage.from('avatars').getPublicUrl(path)
    const url = `${data.publicUrl}?t=${Date.now()}`

    // Mirror the URL to the profiles table
    await admin
      .from('profiles')
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    return apiResponse({ url })
  } catch (err) {
    return apiError(err, 500)
  }
}
