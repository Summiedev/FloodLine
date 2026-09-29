import { useEffect, useState } from 'react'
import { authApi, profileApi } from '../../api/services'
import type { CommunityImpact, User } from '../../api/types'
import type { Navigate } from '../../types'
import { BottomNav } from '../navigation/BottomNav'
import { ScreenButton } from '../ui/ScreenButton'

export function ProfileScreen({ navigate }: { navigate: Navigate }) {
  const [user, setUser] = useState<User | null>(null)
  const [impact, setImpact] = useState<CommunityImpact | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { Promise.all([authApi.me(), profileApi.impact()]).then(([currentUser, stats]) => { setUser(currentUser); setImpact(stats) }).catch(() => setError('Couldn’t load your profile.')) }, [])
  return <main className="settings-screen"><header className="settings-header"><ScreenButton className="back-button" onClick={() => navigate('home')} ariaLabel="Back to map">←</ScreenButton><h1>Profile</h1></header><section className="settings-content">{error && <p className="auth-error" role="alert">{error}</p>}{user && <><div className="profile-card"><span className="profile-avatar">{user.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><h2>{user.displayName}</h2><p>{user.contributorStatus === 'VERIFIED' ? 'Verified Contributor' : 'Community member'}</p></div><h2>Community Impact</h2><div className="impact-grid"><strong>{impact?.reportsSubmitted ?? '—'}<small>Reports</small></strong><strong>{impact?.confirmationsMade ?? '—'}<small>Confirmed</small></strong><strong>{impact?.peopleHelped ?? '—'}<small>Helped</small></strong></div><ScreenButton className="settings-card" onClick={() => navigate('saved-places')}>Your Places</ScreenButton><ScreenButton className="settings-card" onClick={() => navigate('notification-settings')}>Alerts and notifications</ScreenButton><ScreenButton onClick={() => authApi.logout().then(() => navigate('landing')).catch(() => navigate('landing'))}>Sign out</ScreenButton></>}</section><BottomNav navigate={navigate} /></main>
}
