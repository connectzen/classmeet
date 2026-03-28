import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ schoolSlug: string }>
}

export default async function TeacherPage({ params }: Props) {
  const { schoolSlug } = await params
  redirect(`/${schoolSlug}/teacher/dashboard`)
}
