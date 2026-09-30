import { useCallback, useEffect, useState } from 'react'
import { incidentsApi, warningsApi } from '../../api/services'
import { session } from '../../api/session'
import type { Coordinate, IncidentDetail, MapIncident, OfficialWarning } from '../../api/types'
import type { Navigate } from '../../types'
import { BottomNav } from '../navigation/BottomNav'
import { Icon } from '../ui/Icon'
import { ScreenButton } from '../ui/ScreenButton'
import { SearchBar, WarningBanner } from './MapControls'
import { LiveMap } from './LiveMap'

type Viewport = { north: number; south: number; east: number; west: number; limit: number }
const defaultCenter: Coordinate = { longitude: 3.3792, latitude: 6.5244 }

function viewport(point: Coordinate): Viewport {
  return {
    north: Math.min(90, point.latitude + 0.06),
    south: Math.max(-90, point.latitude - 0.06),
    east: Math.min(180, point.longitude + 0.08),
    west: Math.max(-180, point.longitude - 0.08),
    limit: 100,
  }
}

function IncidentSheet({ incident, onClose, onConfirmed, onRequireAuth }: { incident: IncidentDetail; onClose: () => void; onConfirmed: () => void; onRequireAuth: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const confirm = async () => {
    if (!session.accessToken()) { onRequireAuth(); return }
    setConfirming(true)
    setError('')
    try { await incidentsApi.confirm(incident.id); onConfirmed() } catch { setError('This incident may be on cooldown or no longer active.') } finally { setConfirming(false) }
  }
  return <div className="incident-detail-backdrop" role="presentation"><section className="incident-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="incident-detail-title"><ScreenButton className="alert-detail-close" onClick={onClose} ariaLabel="Close incident">×</ScreenButton><span className="settings-kicker">{incident.sourceType}</span><h2 id="incident-detail-title">{incident.locationName}</h2><p>{incident.description}</p><div className="incident-detail-meta"><span>{incident.confidence.label} confidence</span><span>{incident.confirmationCount} confirmations</span><span>{incident.photoCount} photos</span></div>{error && <p className="auth-error" role="alert">{error}</p>}<ScreenButton className="settings-primary" disabled={confirming || incident.status !== 'ACTIVE'} onClick={confirm}>{confirming ? 'Confirming…' : 'Confirm this incident'}</ScreenButton><ScreenButton className="secondary-action" onClick={onClose}>Close</ScreenButton></section></div>
}

export function HomeScreen({ navigate, onRequireAuth }: { navigate: Navigate; onRequireAuth: () => void }) {
  const [incidents, setIncidents] = useState<MapIncident[]>([])
  const [warning, setWarning] = useState<OfficialWarning>()
  const [selected, setSelected] = useState<IncidentDetail | null>(null)
  const [mapCenter, setMapCenter] = useState<Coordinate>(defaultCenter)
  const [locationReady, setLocationReady] = useState(false)
  const [error, setError] = useState('')

  const loadFeed = useCallback(async (nextBounds: Omit<Viewport, 'limit'> & { limit?: number }) => {
    try {
      const [feed, activeWarnings] = await Promise.all([
        incidentsApi.map({ ...nextBounds, limit: nextBounds.limit ?? 100 }),
        warningsApi.active(),
      ])
      setIncidents(feed.data)
      setWarning(activeWarnings.data[0])
      setError('')
    } catch {
      setError('Live flood data is temporarily unavailable.')
    }
  }, [])

  const load = useCallback(() => {
    setError('')
    if (!navigator.geolocation) {
      setError('Showing the default map area. Location access is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude }
        setMapCenter(point)
        setLocationReady(true)
        void loadFeed(viewport(point))
      },
      () => setError('Showing the default map area. Allow location access to center on you.'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  }, [loadFeed])

  useEffect(() => { load() }, [load])

  const openIncident = (id: string) => {
    incidentsApi.detail(id).then(setSelected).catch(() => setError('Incident details are temporarily unavailable.'))
  }

  return <main className="screen-shell map-shell" aria-label="FloodLine home map"><LiveMap center={mapCenter} incidents={incidents} onIncidentClick={openIncident} onViewportChange={(nextBounds) => { void loadFeed({ ...nextBounds, limit: 100 }) }} /><div className="map-wash" /><div className="home-content"><div className="map-top-controls"><SearchBar onClick={() => navigate('route-search', { sheet: true })} /><ScreenButton className="locate-button" ariaLabel="Use current location" onClick={load}><Icon name="locate.svg" /></ScreenButton></div><div className="warning-wrap"><WarningBanner warning={warning} /></div><div className="map-open-space">{!locationReady && <div className="map-location-prompt"><p>Flood activity is visible for the map area. Use your location to center nearby hazards.</p><ScreenButton onClick={load}>Use my location</ScreenButton></div>}{error && <p className="auth-error map-error" role="alert">{error}</p>}<ScreenButton className="plan-route-pill" onClick={() => navigate('route-search', { sheet: true })}><Icon name="route.svg" /><strong>Plan Safe Route</strong></ScreenButton></div></div><BottomNav navigate={navigate} />{selected && <IncidentSheet incident={selected} onClose={() => setSelected(null)} onConfirmed={() => { setSelected(null); void loadFeed(viewport(mapCenter)) }} onRequireAuth={onRequireAuth} />}</main>
}
