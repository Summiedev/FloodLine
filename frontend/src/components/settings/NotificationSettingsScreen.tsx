import { MessageCircle, MessageSquare, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { notificationApi } from '../../api/services'
import type { NotificationChannel, NotificationPreferences } from '../../api/types'
import type { Navigate } from '../../types'
import { BottomNav } from '../navigation/BottomNav'
import { ScreenButton } from '../ui/ScreenButton'

type VerificationPurpose = 'SMS' | 'WHATSAPP'
const channelField: Record<NotificationChannel, 'appPushEnabled' | 'smsEnabled' | 'whatsappEnabled'> = { APP_PUSH: 'appPushEnabled', SMS: 'smsEnabled', WHATSAPP: 'whatsappEnabled' }

export function NotificationSettingsScreen({ navigate }: { navigate: Navigate }) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [error, setError] = useState('')
  const [phone, setPhone] = useState('')
  const [verifiedPhone, setVerifiedPhone] = useState('')
  const [whatsappConnected, setWhatsappConnected] = useState(false)
  const [purpose, setPurpose] = useState<VerificationPurpose | null>(null)
  const [code, setCode] = useState('')
  const [verificationStep, setVerificationStep] = useState<'phone' | 'code'>('phone')
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verificationError, setVerificationError] = useState('')

  useEffect(() => { notificationApi.getPreferences().then((value) => { setPreferences(value); setWhatsappConnected(Boolean(value.channels.find((item) => item.channel === 'WHATSAPP')?.available)) }).catch(() => setError('Couldn’t load notification settings.')) }, [])

  const channel = (value: NotificationChannel) => preferences?.channels.find((item) => item.channel === value)
  const toggle = async (value: NotificationChannel) => {
    const current = channel(value)
    if (!preferences || !current || !current.available) { setError(current?.reason || 'Set up this destination before enabling it.'); return }
    const field = channelField[value]
    setSaving(true); setError('')
    try { setPreferences(await notificationApi.updatePreferences({ [field]: !current.enabled })) }
    catch { setError('Couldn’t update that notification channel.') }
    finally { setSaving(false) }
  }
  const openVerification = (nextPurpose: VerificationPurpose) => { setPurpose(nextPurpose); setVerificationStep('phone'); setCode(''); setVerificationError('') }
  const sendCode = async () => { setVerifying(true); setVerificationError(''); try { if (purpose === 'SMS') await notificationApi.startPhoneVerification({ phoneNumber: phone }); else await notificationApi.startWhatsAppVerification({ phoneNumber: phone }); setVerificationStep('code') } catch { setVerificationError('Couldn’t send a code. Check the number and try again.') } finally { setVerifying(false) } }
  const confirmCode = async () => { setVerifying(true); setVerificationError(''); try { if (purpose === 'SMS') { const result = await notificationApi.confirmPhoneVerification({ code }); setVerifiedPhone(result.destination) } else { await notificationApi.confirmWhatsAppVerification({ code }); setWhatsappConnected(true) }; setPreferences(await notificationApi.getPreferences()); setPurpose(null) } catch { setVerificationError('That code is invalid or expired. Please try again.') } finally { setVerifying(false) } }
  const maskPhone = (value: string) => value.length > 4 ? `•••• ${value.slice(-4)}` : value

  return <main className="settings-screen notification-screen"><header className="settings-header"><ScreenButton className="back-button" onClick={() => navigate('alert-types')} ariaLabel="Back to alert types">←</ScreenButton><h1>Notifications</h1></header><section className="settings-content"><h2>How should we reach you?</h2>{error && <p className="auth-error" role="alert">{error}</p>}{!preferences ? <p className="settings-state">Loading your notification settings…</p> : <div className="notification-cards"><ChannelCard icon={<Smartphone size={22} />} title="App notifications" description="Fast alerts while you're using your smartphone." badge="RECOMMENDED" enabled={Boolean(channel('APP_PUSH')?.enabled)} available={Boolean(channel('APP_PUSH')?.available)} onToggle={() => toggle('APP_PUSH')} disabled={saving} /><ChannelCard icon={<MessageCircle size={22} />} title="WhatsApp" description="Receive flood alerts in WhatsApp." enabled={Boolean(channel('WHATSAPP')?.enabled)} available={Boolean(channel('WHATSAPP')?.available)} onToggle={() => toggle('WHATSAPP')} disabled={saving}><ScreenButton className="channel-action" onClick={() => whatsappConnected ? notificationApi.disconnectWhatsApp().then(() => { setWhatsappConnected(false); return notificationApi.getPreferences() }).then(setPreferences).catch(() => setError('Couldn’t disconnect WhatsApp.')) : openVerification('WHATSAPP')}>{whatsappConnected ? 'Connected · Disconnect' : 'Connect WhatsApp'}</ScreenButton></ChannelCard><ChannelCard icon={<MessageSquare size={22} />} title="SMS" description="Useful when mobile data is weak or unavailable." enabled={Boolean(channel('SMS')?.enabled)} available={Boolean(channel('SMS')?.available)} onToggle={() => toggle('SMS')} disabled={saving}><ScreenButton className="channel-action" onClick={() => openVerification('SMS')}>{verifiedPhone ? maskPhone(verifiedPhone) : 'Add phone number'}</ScreenButton></ChannelCard></div>}<ScreenButton className="settings-primary notification-review" onClick={() => navigate('profile')}>Review Setup</ScreenButton></section><BottomNav navigate={navigate} />{purpose && <div className="verification-backdrop" role="presentation"><section className="verification-sheet" role="dialog" aria-modal="true" aria-labelledby="verification-title"><div className="verification-sheet-header"><h2 id="verification-title">{purpose === 'SMS' ? 'Add phone number' : 'Connect WhatsApp'}</h2><ScreenButton onClick={() => setPurpose(null)} ariaLabel="Close verification">×</ScreenButton></div>{verificationStep === 'phone' ? <><label>Phone number<input autoFocus value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+2348012345678" type="tel" /></label><p className="verification-help">Use international format, for example +2348012345678.</p>{verificationError && <p className="auth-error" role="alert">{verificationError}</p>}<ScreenButton className="settings-primary" disabled={verifying || phone.length < 8} onClick={sendCode}>{verifying ? 'Sending…' : 'Send code'}</ScreenButton></> : <><label>Verification code<input autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="000000" /></label>{verificationError && <p className="auth-error" role="alert">{verificationError}</p>}<ScreenButton className="settings-primary" disabled={verifying || code.length !== 6} onClick={confirmCode}>{verifying ? 'Verifying…' : 'Verify'}</ScreenButton><ScreenButton className="verification-resend" disabled={verifying} onClick={sendCode}>Resend code</ScreenButton></>}</section></div>}</main>
}

function ChannelCard({ icon, title, description, badge, enabled, available, onToggle, disabled, children }: { icon: React.ReactNode; title: string; description: string; badge?: string; enabled: boolean; available: boolean; onToggle: () => void; disabled: boolean; children?: React.ReactNode }) { return <article className="notification-card"><div className="notification-card-row"><span className="notification-icon">{icon}</span><span className="notification-copy"><strong>{title}</strong>{badge && <em>{badge}</em>}<small>{description}</small>{!available && <small className="notification-unavailable">Set up this destination to enable it.</small>}</span><button className={`toggle-control ${enabled ? 'is-on' : ''}`} type="button" role="switch" aria-checked={enabled} aria-label={`Enable ${title}`} disabled={disabled || !available} onClick={onToggle}><span /></button></div>{children}</article> }
