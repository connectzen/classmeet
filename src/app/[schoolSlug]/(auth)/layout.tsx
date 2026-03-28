import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

interface Props {
  children: ReactNode
  params: Promise<{ schoolSlug: string }>
}

export default async function SchoolAuthLayout({ children, params }: Props) {
  const { schoolSlug } = await params
  const supabase = await createClient()

  // Verify the school exists
  const { data: school } = await supabase
    .from('schools')
    .select('id, name, slug, logo_url, primary_color, secondary_color')
    .eq('slug', schoolSlug)
    .single()

  if (!school) notFound()

  return (
    <div data-school-id={school.id} data-school-slug={school.slug}>
      {children}
    </div>
  )
}
