import type { SupabaseClient } from '@supabase/supabase-js'

// Module-level map: blob URL → File (for images added during editing, not yet uploaded)
export const pendingImages = new Map<string, File>()

/**
 * Process lesson HTML: upload any blob: URLs to Supabase Storage
 * and replace them with permanent public URLs.
 */
export async function processLessonImages(
  html: string,
  courseId: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<string> {
  const blobUrlRegex = /blob:https?:\/\/[^\s"'<>]+/g
  const blobUrls = [...new Set(html.match(blobUrlRegex) || [])]
  if (blobUrls.length === 0) return html

  let processed = html
  for (const blobUrl of blobUrls) {
    const file = pendingImages.get(blobUrl)
    if (!file) continue

    const ext = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const storagePath = `${userId}/${courseId}/${fileName}`

    const { error } = await supabase.storage.from('lesson-images').upload(storagePath, file)
    if (error) continue

    const { data } = supabase.storage.from('lesson-images').getPublicUrl(storagePath)
    if (data?.publicUrl) {
      processed = processed.replaceAll(blobUrl, data.publicUrl)
      pendingImages.delete(blobUrl)
      URL.revokeObjectURL(blobUrl)
    }
  }

  return processed
}

/**
 * Delete images from storage that are no longer referenced in any lesson HTML.
 * Call this after processLessonImages so all blob URLs have been resolved.
 */
export async function cleanupOrphanedImages(
  allLessonHtmls: string[],
  courseId: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<void> {
  const prefix = `${userId}/${courseId}`
  const { data: files } = await supabase.storage.from('lesson-images').list(prefix)
  if (!files || files.length === 0) return

  // Combine all lesson HTML to check which file names are still referenced
  const allHtml = allLessonHtmls.join(' ')

  const orphanPaths: string[] = []
  for (const file of files) {
    if (!allHtml.includes(file.name)) {
      orphanPaths.push(`${prefix}/${file.name}`)
    }
  }

  if (orphanPaths.length > 0) {
    await supabase.storage.from('lesson-images').remove(orphanPaths)
  }
}
