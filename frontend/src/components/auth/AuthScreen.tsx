import { useState, type FormEvent } from 'react'
import { authApi } from '../../api/services'
import { Icon } from '../ui/Icon'
import { ScreenButton } from '../ui/ScreenButton'
import type { Navigate } from '../../types'

type AuthMode = 'login' | 'register'

export function AuthScreen({ mode, navigate }: { mode: AuthMode; navigate: Navigate }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (mode === 'register' && !name.trim()) return setError('Add your name to continue.')
    if (!email.includes('@')) return setError('Enter a valid email address.')
    if (password.length < 12) return setError('Use at least 12 characters for your password.')
    if (mode === 'register' && !accepted) return setError('Accept the terms to create your account.')
    setError(''); setStatus(''); setSubmitting(true)
    try {
      if (mode === 'login') await authApi.login(email, password)
      else await authApi.register(name, email, password)
      setStatus(mode === 'login' ? 'Signed in. Opening your map…' : 'Account created. Opening your map…')
      navigate('home')
    } catch { setError(mode === 'login' ? 'Those sign-in details were not accepted.' : 'Could not create your account. Check your details and try again.') }
    finally { setSubmitting(false) }
  }

  return <main className="auth-screen" aria-label={mode === 'login' ? 'Sign in to FloodLine' : 'Create a FloodLine account'}>
    <section className="auth-panel auth-brand-panel">
      <ScreenButton className="auth-back-link" onClick={() => navigate('landing')}>← Back</ScreenButton>
      <div className="auth-brand-lockup"><span className="auth-brand-mark"><Icon name="route.svg" /></span><strong>FloodLine</strong></div>
      <div className="auth-brand-copy"><span>Safer journeys start with better information.</span><p>Keep your saved places, reports, and route preferences together.</p></div><div className="auth-brand-map" />
    </section>
    <section className="auth-panel auth-form-panel">
      <div className="auth-form-wrap">
        <div className="auth-heading"><span className="auth-kicker">FloodLine account</span><h1>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1><p>{mode === 'login' ? 'Sign in to continue to your live flood map.' : 'Save places and help your community move with more certainty.'}</p></div>
        <ScreenButton className="google-button" onClick={() => setError('Google sign-in is not enabled yet. Use email and password.')}><span className="google-mark">G</span>{mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}</ScreenButton>
        <div className="auth-divider"><span>or continue with email</span></div>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Amina Yusuf" autoComplete="name" /></label>}
          <label>Email address<input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" autoComplete="email" /></label>
          <label>Password<span className="password-field"><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><ScreenButton className="password-toggle" onClick={() => setShowPassword((value) => !value)} ariaLabel={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</ScreenButton></span></label>
          {mode === 'login' ? <div className="auth-form-options"><label className="auth-check"><input type="checkbox" defaultChecked /><span />Remember me</label><ScreenButton className="auth-text-button">Forgot password?</ScreenButton></div> : <label className="auth-check auth-terms"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span />I agree to the FloodLine terms and privacy policy.</label>}
          {error && <p className="auth-error" role="alert">{error}</p>}{status && <p className="auth-status" role="status">{status}</p>}
          <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <p className="auth-switch">{mode === 'login' ? 'New to FloodLine?' : 'Already have an account?'} <ScreenButton className="auth-text-button" onClick={() => navigate(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in'}</ScreenButton></p>
      </div>
    </section>
  </main>
}
