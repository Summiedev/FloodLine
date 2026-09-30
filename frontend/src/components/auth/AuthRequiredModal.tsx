import { LockKeyhole } from 'lucide-react'
import { ScreenButton } from '../ui/ScreenButton'

export function AuthRequiredModal({ onClose, onSignIn, onRegister }: { onClose: () => void; onSignIn: () => void; onRegister: () => void }) {
  return <div className="auth-required-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <section className="auth-required-modal" role="dialog" aria-modal="true" aria-labelledby="auth-required-title">
      <ScreenButton className="auth-required-close" onClick={onClose} ariaLabel="Close sign-in message">×</ScreenButton>
      <span className="auth-required-icon"><LockKeyhole size={22} /></span>
      <span className="settings-kicker">FloodLine account</span>
      <h2 id="auth-required-title">You’re not signed in</h2>
      <p>Sign in to save places, receive alerts, submit reports, and help verify flood incidents.</p>
      <ScreenButton className="settings-primary auth-required-primary" onClick={onSignIn}>Sign in</ScreenButton>
      <ScreenButton className="auth-required-secondary" onClick={onRegister}>Create an account</ScreenButton>
      <ScreenButton className="auth-required-dismiss" onClick={onClose}>Not now</ScreenButton>
    </section>
  </div>
}
