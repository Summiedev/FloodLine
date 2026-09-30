import { useEffect, useState } from 'react'
import { navigationApi } from '../../api/services'
import type { NavigationSession } from '../../api/types'
import type { Navigate } from '../../types'
import { ScreenButton } from '../ui/ScreenButton'
import { ActiveRouteSheet, HazardItem, RouteFlowCanvas, SheetHandle } from './RoutePrimitives'
import { loadRoutePlan } from './route-state'

export function HazardsScreen({ navigate }: { navigate: Navigate }) {
  const plan = loadRoutePlan()
  const route = plan?.preview.routes.find((item) => item.recommended) ?? plan?.preview.routes[0]
  const hazards = route?.risk.incidents ?? []
  return <RouteFlowCanvas routeGeometry={route?.geometry} routeCenter={plan?.origin} destinationLabel={plan?.destinationLabel} onClose={() => navigate('route-results')}><section className="route-state-sheet hazards-sheet"><SheetHandle /><h1>{hazards.length} flood hazard{hazards.length === 1 ? '' : 's'} on this route</h1>{hazards.length ? <div className="hazard-list">{hazards.map((hazard) => <HazardItem key={hazard.id} tone={hazard.severity === 'SEVERE' ? 'severe' : 'moderate'} title={hazard.locationName} severity={`${hazard.severity} flooding`} detail={`${hazard.confidenceLabel} confidence · ${Math.round(hazard.distanceMeters)} m from route`} />)}</div> : <p className="sheet-description">No currently known reports were returned for this route.</p>}<div className="sheet-actions"><ScreenButton className="secondary-action" onClick={() => navigate('route-results')}>Back to routes</ScreenButton></div></section></RouteFlowCanvas>
}

export function RerouteScreen({ navigate }: { navigate: Navigate }) {
  const plan = loadRoutePlan()
  const route = plan?.preview.routes.find((item) => item.recommended) ?? plan?.preview.routes[0]
  return <RouteFlowCanvas routeGeometry={route?.geometry} routeCenter={plan?.origin} destinationLabel={plan?.destinationLabel} statusLabel="Route updated" onClose={() => navigate('hazards')}><section className="route-state-sheet reroute-sheet"><SheetHandle /><div className="sheet-title-row"><span className="danger-dot" /><h1>New flooding reported ahead</h1></div><p className="sheet-description">A lower reported flood-risk alternative may be available. Review the route options before continuing.</p><div className="sheet-actions"><ScreenButton className="primary-action" onClick={() => navigate('route-results')}>View route options</ScreenButton><ScreenButton className="text-action" onClick={() => navigate('active')}>Stay on current route</ScreenButton></div></section></RouteFlowCanvas>
}

export function ActiveRouteScreen({ navigate }: { navigate: Navigate }) {
  const [session, setSession] = useState<NavigationSession | null>(null); const [error, setError] = useState(''); const id = sessionStorage.getItem('floodline-navigation-session'); const plan = loadRoutePlan()
  useEffect(() => { if (!id) { setError('No active navigation session was found.'); return }; let active = true; const refresh = () => { navigationApi.get(id).then((value) => { if (active) setSession(value) }).catch(() => { if (active) setError('Navigation session is no longer available.') }) }; refresh(); const timer = window.setInterval(refresh, 15_000); return () => { active = false; window.clearInterval(timer) } }, [id])
  const stop = () => { if (!session) return; navigationApi.stop(session.id).then(() => navigate('home')).catch(() => setError('Navigation could not be ended.')) }
  if (error) return <main className="screen-shell settings-screen"><section className="settings-state"><p>{error}</p><ScreenButton onClick={() => navigate('route-search')}>Plan a route</ScreenButton></section></main>
  const latestUpdate = session?.updates?.find((update) => update.status === 'SENT')
  const fallbackRoute = plan?.preview.routes.find((item) => item.id === session?.routeId) ?? plan?.preview.routes.find((item) => item.recommended) ?? plan?.preview.routes[0]
  return <RouteFlowCanvas noOverlay routeGeometry={session?.routeGeometry ?? fallbackRoute?.geometry} routeCenter={session?.origin ?? plan?.origin} destinationLabel={plan?.destinationLabel ?? 'your destination'} durationSeconds={session?.route.durationSeconds} distanceMeters={session?.route.distanceMeters} statusLabel={latestUpdate ? 'Route updated' : 'Route active'} routeUpdated={Boolean(latestUpdate)} updateMessage={latestUpdate ? 'Avoiding a reported flood hazard on your route.' : undefined}><ActiveRouteSheet onStop={stop} /></RouteFlowCanvas>
}
