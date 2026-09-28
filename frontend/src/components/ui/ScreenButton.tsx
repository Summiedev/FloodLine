import type { ReactNode } from 'react'

type ScreenButtonProps = {
  children: ReactNode
  onClick?: () => void
  className?: string
  ariaLabel?: string
  disabled?: boolean
}

export function ScreenButton({ children, onClick, className = '', ariaLabel, disabled = false }: ScreenButtonProps) {
  return <button className={className} onClick={onClick} type="button" aria-label={ariaLabel} disabled={disabled}>{children}</button>
}
