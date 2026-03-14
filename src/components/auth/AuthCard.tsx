import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { Video } from 'lucide-react'

interface AuthCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}

export default function AuthCard({
  title,
  subtitle,
  children,
  className,
}: AuthCardProps) {
  return (
    <div className="auth-page">
      {/* Background glows */}
      <div className="auth-bg-glow" />
      <div className="auth-bg-glow-bottom" />

      <div className={cn('auth-card', className)}>
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <Video size={26} color="#fff" />
          </div>
          <span className="auth-logo-name">ClassMeet</span>
        </div>

        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}

        {children}
      </div>
    </div>
  )
}

