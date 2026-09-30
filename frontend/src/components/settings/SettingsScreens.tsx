import { BellRing, ChevronRight, HeartHandshake, LogOut, MapPinned, Megaphone, Route, ShieldCheck, UsersRound, Waves } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { authApi, profileApi } from '../../api/services'
import type { CommunityImpact, User } from '../../api/types'
import type { Navigate } from '../../types'
import { BottomNav } from '../navigation/BottomNav'
import { ScreenButton } from '../ui/ScreenButton'

function initials(displayName: string): string {
  return displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

function ProfileAction({ icon, title, description, onClick }: { icon: ReactNode; title: string; description: string; onClick: () => void }) {
  return <ScreenButton className="profile-action-card" onClick={onClick}><span className="profile-action-icon">{icon}</span><span className="profile-action-copy"><strong>{title}</strong><small>{description}</small></span><ChevronRight className="profile-action-arrow" size={19} aria-hidden="true" /></ScreenButton>
}

export function ProfileScreen({ navigate }: { navigate: Navigate }) {
  const [user, setUser] = useState<User | null>(null)
  const [impact, setImpact] = useState<CommunityImpact | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    Promise.all([authApi.me(), profileApi.impact()])
      .then(([currentUser, stats]) => { setUser(currentUser); setImpact(stats) })
      .catch(() => setError('Couldn’t load your profile.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const signOut = async () => {
    setSigningOut(true)
    try { await authApi.logout() } finally { navigate('landing') }
  }

  return <main className="settings-screen profile-screen">
    <header className="profile-page-header"><span className="settings-kicker">FloodLine account</span><h1>Your profile</h1><p>See the difference your local flood reports make.</p></header>
    <section className="profile-content">
      {error && <div className="profile-error" role="alert"><p>{error}</p><ScreenButton onClick={load}>Retry</ScreenButton></div>}
      {loading ? <div className="profile-skeleton" aria-label="Loading profile"><span /><span /><span /><span /></div> : user && <>
        <section className="profile-hero-card">
          <div className="profile-hero-main"><span className="profile-avatar profile-avatar-large">{initials(user.displayName)}</span><div><span className="profile-eyebrow">Community member</span><h2>{user.displayName}</h2><p>{user.email || user.phoneNumber || 'FloodLine member'}</p></div><span className="profile-trust-badge"><ShieldCheck size={17} />{user.contributorStatus === 'VERIFIED' ? 'Verified' : 'Standard'}</span></div>
          <div className="profile-hero-footer"><span><Waves size={15} />Helping Lagos move with better information</span><small>Trust status is managed by FloodLine</small></div>
        </section>

        <section className="profile-section"><div className="profile-section-heading"><div><span className="settings-kicker">Your contribution</span><h2>Community impact</h2></div><HeartHandshake size={25} /></div><div className="profile-impact-grid">
          <article className="profile-impact-stat impact-blue"><MapPinned size={19} /><strong>{impact?.reportsSubmitted ?? '—'}</strong><small>Reports submitted</small></article>
          <article className="profile-impact-stat impact-orange"><ShieldCheck size={19} /><strong>{impact?.confirmationsMade ?? '—'}</strong><small>Incidents confirmed</small></article>
          <article className="profile-impact-stat impact-green"><UsersRound size={19} /><strong>{impact?.peopleHelped ?? '—'}</strong><small>People helped</small></article>
          <article className="profile-impact-stat impact-purple"><BellRing size={19} /><strong>{impact?.alertRecipientsFromContributedIncidents ?? '—'}</strong><small>Alert recipients</small></article>
        </div></section>

        <section className="profile-section"><div className="profile-section-heading"><div><span className="settings-kicker">Personal setup</span><h2>Stay prepared</h2></div></div><div className="profile-actions">
          <ProfileAction icon={<MapPinned size={20} />} title="Your places" description="Choose the areas FloodLine should watch." onClick={() => navigate('saved-places')} />
          <ProfileAction icon={<Route size={20} />} title="Alert preferences" description="Set your radius and flood event types." onClick={() => navigate('alert-radius')} />
          <ProfileAction icon={<BellRing size={20} />} title="Notification channels" description="Manage app, SMS, and WhatsApp destinations." onClick={() => navigate('notification-settings')} />
          <ProfileAction icon={<Megaphone size={20} />} title="Alert history" description="Review warnings and route updates." onClick={() => navigate('alerts')} />
        </div></section>

        <div className="profile-community-note"><span><HeartHandshake size={20} /></span><div><strong>Every confirmation helps someone decide</strong><p>Your verified contributions help FloodLine alert people before they enter a flooded area.</p></div></div>
        <ScreenButton className="profile-signout" disabled={signingOut} onClick={signOut}><LogOut size={17} />{signingOut ? 'Signing out…' : 'Sign out'}</ScreenButton>
      </>}
    </section>
    <BottomNav navigate={navigate} />
  </main>
}
