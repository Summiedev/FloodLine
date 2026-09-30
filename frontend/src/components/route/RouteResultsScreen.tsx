import { useState } from 'react'
import { ApiError } from '../../api/client'
import { navigationApi } from '../../api/services'
import { session } from '../../api/session'
import type { RouteCandidate } from '../../api/types'
import type { Navigate } from '../../types'
import { ScreenButton } from '../ui/ScreenButton'
import { Icon } from '../ui/Icon'
import { ModeTab } from './RoutePrimitives'
import { loadRoutePlan } from './route-state'
import { LiveMap } from '../map/LiveMap'

function duration(seconds: number): string { const minutes = Math.max(1, Math.round(seconds / 60)); return `${minutes} min` }
function RouteCard({ route, index, navigate, onStart, starting }: { route: RouteCandidate; index: number; navigate: Navigate; onStart: (route: RouteCandidate) => void; starting: boolean }) { const lowRisk = route.risk.riskLevel === 'LOW'; return <article className={`route-card ${index === 0 ? 'route-card-primary' : 'route-card-secondary'}`}>{route.recommended && <span className="recommended-badge">Recommended</span>}<div className="route-card-head"><div><h2>Route {String.fromCharCode(65 + index)}</h2><span>{duration(route.durationSeconds)} · {(route.distanceMeters / 1000).toFixed(1)} km</span><strong>{route.risk.summary}</strong></div><span className={lowRisk ? 'lower-risk-badge' : 'flood-report-badge'}><i />{lowRisk ? 'Lower risk' : `${route.risk.affectingIncidentCount} report${route.risk.affectingIncidentCount === 1 ? '' : 's'}`}</span></div><p>{route.risk.affectingIncidentCount === 0 ? 'No currently known reports on this route.' : `${route.risk.affectingIncidentCount} reported hazard${route.risk.affectingIncidentCount === 1 ? '' : 's'} along this route.`}</p>{route.risk.affectingIncidentCount > 0 && <ScreenButton className="route-card-link" onClick={() => navigate('hazards')}><Icon name="route-results-hazard.svg" /><span>View hazards</span></ScreenButton>}<ScreenButton className="start-navigation" onClick={() => onStart(route)} disabled={starting}><Icon name="route.svg" /><span>{starting ? 'Starting…' : 'Start Navigation'}</span></ScreenButton></article> }

export function RouteResultsScreen({ navigate, onRequireAuth }: { navigate: Navigate; onRequireAuth: () => void }) {
  const plan = loadRoutePlan(); const [startingRouteId, setStartingRouteId] = useState<string | null>(null); const [error, setError] = useState('')
  const start = async (route: RouteCandidate) => {
    if (!plan || startingRouteId) return
    if (!session.accessToken()) { onRequireAuth(); return }
    setStartingRouteId(route.id)
    setError('')
    try {
      const navigationSession = await navigationApi.start({ origin: plan.origin, destination: plan.destination, travelMode: plan.travelMode, route: { id: route.id, geometry: route.geometry, distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds } })
      sessionStorage.setItem('floodline-navigation-session', navigationSession.id)
      navigate('active')
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) onRequireAuth()
      else setError('Navigation could not be started. Please try again.')
    } finally { setStartingRouteId(null) }
  }
  if (!plan) return <main className="screen-shell results-shell"><header className="results-header"><ScreenButton className="back-button" onClick={() => navigate('route-search')} ariaLabel="Go back">←</ScreenButton><h1>Route options</h1></header><section className="settings-state"><p>Your route search has expired. Start again.</p><ScreenButton onClick={() => navigate('route-search')}>Search again</ScreenButton></section></main>
  return <main className="screen-shell results-shell" aria-label={`Routes to ${plan.destinationLabel}`}><header className="results-header"><ScreenButton className="back-button" onClick={() => navigate('route-search')} ariaLabel="Go back">←</ScreenButton><div className="results-heading"><span>To: {plan.destinationLabel}</span><div className="mode-tabs"><ModeTab icon="route-results-car.svg" active /><ModeTab icon="route-results-bus.svg" /><ModeTab icon="route-results-bike.svg" /><ModeTab icon="route-results-walk.svg" /></div></div></header><section className="route-map-area"><LiveMap className="route-live-map" center={plan.origin} userLocation={plan.origin} routeGeometries={plan.preview.routes} /><div className="routes-stack"><div className="routes-panel-heading"><span>Flood-aware route options</span><h1>Choose your route</h1><p>Compare travel time with currently reported flood risk.</p></div>{error && <p className="auth-error" role="alert">{error}</p>}{plan.preview.routes.map((route, index) => <RouteCard key={route.id} route={route} index={index} navigate={navigate} onStart={start} starting={startingRouteId === route.id} />)}</div></section></main>
}
