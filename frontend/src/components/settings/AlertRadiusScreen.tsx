import { useEffect, useState } from 'react'
import { alertPreferencesApi } from '../../api/services'
import type { Navigate } from '../../types'
import { BottomNav } from '../navigation/BottomNav'
import { ScreenButton } from '../ui/ScreenButton'

function formatRadius(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1).replace('.0', '')} km` : `${meters} m`
}

function radiusCopy(meters: number): string {
  if (meters <= 500) return 'Best for immediate surroundings.'
  if (meters <= 1000) return 'Useful for nearby streets.'
  if (meters <= 2000) return 'Useful for neighborhood awareness.'
  return 'Useful for wider commute awareness.'
}

export function AlertRadiusScreen({ navigate }: { navigate: Navigate }) {
  const [radiusMeters, setRadiusMeters] = useState(1000)
  const [incidentTypes, setIncidentTypes] = useState<import('../../api/types').IncidentType[]>(['SEVERE_FLOODING'])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    alertPreferencesApi.get()
      .then((preferences) => { setRadiusMeters(Math.min(5000, Math.max(500, preferences.radiusMeters))); setIncidentTypes(preferences.incidentTypes) })
      .catch(() => setError('Couldn’t load your alert radius.'))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await alertPreferencesApi.update({ radiusMeters, incidentTypes })
      navigate('alert-types')
    } catch {
      setError('Couldn’t save your alert radius. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const visualSize = `${25 + (radiusMeters / 5000) * 60}%`

  return <main className="settings-screen alert-radius-screen"><header className="settings-header"><ScreenButton className="back-button" onClick={() => navigate('saved-places')} ariaLabel="Back to saved places">←</ScreenButton><h1>Alert Radius</h1></header>{loading ? <p className="settings-state">Loading your alert radius…</p> : <><section className="radius-visual" aria-label={`Alert radius ${formatRadius(radiusMeters)}`}><span className="radius-map-road radius-map-road-one" /><span className="radius-map-road radius-map-road-two" /><span className="radius-circle" style={{ width: visualSize, height: visualSize }} /><span className="radius-place-point" /></section><section className="radius-content"><h2>How close should flooding be before we alert you?</h2><output className="radius-selected-value">{formatRadius(radiusMeters)}</output><input className="radius-slider" aria-label="Alert radius in meters" type="range" min="500" max="5000" step="100" value={radiusMeters} onChange={(event) => setRadiusMeters(Number(event.target.value))} /><div className="radius-scale" aria-hidden="true"><span>500 m</span><span>1 km</span><span>2 km</span><span>5 km</span></div><div className="radius-copy-card"><strong>{formatRadius(radiusMeters)}</strong><p>{radiusCopy(radiusMeters)}</p></div>{error && <p className="auth-error" role="alert">{error}</p>}<ScreenButton className="settings-primary radius-continue" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Continue'}</ScreenButton></section></>}<BottomNav navigate={navigate} /></main>
}
