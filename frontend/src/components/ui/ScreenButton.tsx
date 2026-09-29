import type { CSSProperties, ReactNode } from 'react'

type ScreenButtonProps = {
  children: ReactNode
  onClick?: () => void
  className?: string
  ariaLabel?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  title?: string
  style?: CSSProperties
}

export function ScreenButton({ children, onClick, className = '', ariaLabel, disabled = false, type = 'button', title, style }: ScreenButtonProps) {
  return <button className={className} onClick={onClick} type={type} aria-label={ariaLabel} title={title} style={style} disabled={disabled}>{children}</button>
}
