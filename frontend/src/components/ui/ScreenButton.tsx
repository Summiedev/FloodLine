import type { CSSProperties, ReactNode } from 'react'

type ScreenButtonProps = {
  children: ReactNode
  onClick?: () => void
  className?: string
  ariaLabel?: string
  disabled?: boolean
  ariaBusy?: boolean
  type?: 'button' | 'submit' | 'reset'
  title?: string
  style?: CSSProperties
}

export function ScreenButton({ children, onClick, className = '', ariaLabel, disabled = false, ariaBusy, type = 'button', title, style }: ScreenButtonProps) {
  return <button className={className} onClick={onClick} type={type} aria-label={ariaLabel} aria-busy={ariaBusy} title={title} style={style} disabled={disabled}>{children}</button>
}
