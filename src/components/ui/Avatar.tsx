import { cn, getInitials, getAvatarGradient } from '@/lib/utils'
import Image from 'next/image'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: AvatarSize
  online?: boolean
  className?: string
}

const sizeMap: Record<AvatarSize, string> = {
  xs: 'avatar-xs',
  sm: 'avatar-sm',
  md: 'avatar-md',
  lg: 'avatar-lg',
  xl: 'avatar-xl',
  '2xl': 'avatar-2xl',
}

const pixelMap: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 72,
  '2xl': 96,
}

export default function Avatar({
  src,
  name,
  size = 'md',
  online = false,
  className,
}: AvatarProps) {
  return (
    <div
      className={cn(
        'avatar',
        sizeMap[size],
        !src && getAvatarGradient(name),
        online && 'avatar-online',
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={name ?? 'avatar'}
          width={pixelMap[size]}
          height={pixelMap[size]}
          style={{ objectFit: 'cover' }}
        />
      ) : (
        <span aria-label={name ?? 'User'}>{getInitials(name)}</span>
      )}
    </div>
  )
}

