import { AlertTriangle, Droplets } from 'lucide-react'
import { useEffect, useState } from 'react'
import { alertPreferencesApi } from '../../api/services'
import type { AlertPreferences, IncidentType } from '../../api/types'
import type { Navigate } from '../../types'
import { BottomNav } from '../navigation/BottomNav'
import { ScreenButton } from '../ui/ScreenButton'

type AlertOption = { value: IncidentType; title: string; description: string; icon: 'severe' | 'warning' | 'drain' }
const alertOptions: AlertOption[] = [
  { value: 'SEVERE_FLOODING', title: 'Severe flooding', description: 'Roads may be difficult or impossible to use.', icon: 'severe' },
  { value: 'MODERATE_FLOODING', title: 'Moderate flooding', description: 'Traffic may slow or smaller vehicles may struggle.', icon: 'warning' },
  { value: 'BLOCKED_ROAD', title: 'Blocked roads', description: 'Roads reported inaccessible.', icon: 'warning' },
  { value: 'BLOCKED_DRAIN', title: 'Blocked drains', description: 'Drainage problems reported nearby.', icon: 'drain' },
]

export function AlertTypesScreen({ navigate }: { navigate: Navigate }) {
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>(['SEVERE_FLOODING'])
  const [radiusMeters, setRadiusMeters] = useState(1000)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    alertPreferencesApi.get().then((preferences) => {
      const validTypes = preferences.incidentTypes.filter((type): type is IncidentType => alertOptions.some((option) => option.value === type))
      setIncidentTypes(validTypes.includes('SEVERE_FLOODING') ? validTypes : ['SEVERE_FLOODING', ...validTypes])
      setRadiusMeters(preferences.radiusMeters)
    }).catch(() => setError('Couldn’t load your alert types.')).finally(() => setLoading(false))
  }, [])

  const toggle = (value: IncidentType) => {
    if (value === 'SEVERE_FLOODING') return
    setIncidentTypes((current) => current.includes(value) ? current.filter((type) => type !== value) : [...current, value])
  }

  const save = async () => {
    setSaving(true); setError('')
    try {
      await alertPreferencesApi.update({ radiusMeters, incidentTypes: incidentTypes.includes('SEVERE_FLOODING') ? incidentTypes : ['SEVERE_FLOODING', ...incidentTypes] })
      navigate('notification-settings')
    } catch { setError('Couldn’t save your alert types. Please try again.') } finally { setSaving(false) }
  }

  return <main className="settings-screen alert-types-screen"><header className="settings-header"><ScreenButton className="back-button" onClick={() => navigate('alert-radius')} ariaLabel="Back to alert radius">←</ScreenButton><h1>Alert Types</h1></header><section className="settings-content"><h2>What should we alert you about?</h2>{loading ? <p className="settings-state">Loading your alert types…</p> : <><div className="alert-type-options">{alertOptions.map((option) => { const enabled = option.value === 'SEVERE_FLOODING' || incidentTypes.includes(option.value); return <div className="alert-type-card" key={option.value}><span className={`alert-type-icon alert-type-icon-${option.icon}`}>{option.icon === 'drain' ? <Droplets size={22} /> : <AlertTriangle size={22} />}</span><span className="alert-type-copy"><strong>{option.title}</strong><small>{option.description}</small></span>{option.value === 'SEVERE_FLOODING' ? <span className="always-on">Always ON</span> : <button className={`toggle-control ${enabled ? 'is-on' : ''}`} type="button" role="switch" aria-checked={enabled} aria-label={`Enable ${option.title}`} onClick={() => toggle(option.value)}><span /></button>}</div> })}</div>{error && <p className="auth-error" role="alert">{error}</p>}<ScreenButton className="settings-primary alert-types-continue" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Continue'}</ScreenButton></>}</section><BottomNav navigate={navigate} /></main>
}
