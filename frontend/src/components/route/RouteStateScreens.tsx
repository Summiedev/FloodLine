import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { demoApi, incidentsApi, navigationApi, warningsApi } from '../../api/services'
import type { Coordinate, MapIncident, NavigationSession, OfficialWarning } from '../../api/types'
import { env } from '../../config/env'
import type { Navigate } from '../../types'
import { ScreenButton } from '../ui/ScreenButton'
import { ActiveRouteSheet, HazardItem, RouteFlowCanvas, SheetHandle } from './RoutePrimitives'
import { loadHazardsRouteId, loadRoutePlan, saveHazardsRouteId } from './route-state'

type DemoRoutePath = {
  points: Coordinate[]
  cumulativeMeters: number[]
  totalMeters: number
}

function distanceMeters(a: Coordinate, b: Coordinate): number {
  const earthRadius = 6371000
  const toRadians = (value: number) => value * Math.PI / 180
  const latitudeDelta = toRadians(b.latitude - a.latitude)
  const longitudeDelta = toRadians(b.longitude - a.longitude)
  const latitudeA = toRadians(a.latitude)
  const latitudeB = toRadians(b.latitude)
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function bearingDegrees(a: Coordinate, b: Coordinate): number {
  const toRadians = (value: number) => value * Math.PI / 180
  const toDegrees = (value: number) => value * 180 / Math.PI
  const longitudeDelta = toRadians(b.longitude - a.longitude)
  const latitudeA = toRadians(a.latitude)
  const latitudeB = toRadians(b.latitude)
  const y = Math.sin(longitudeDelta) * Math.cos(latitudeB)
  const x = Math.cos(latitudeA) * Math.sin(latitudeB)
    - Math.sin(latitudeA) * Math.cos(latitudeB) * Math.cos(longitudeDelta)
  return (toDegrees(Math.atan2(y, x)) + 360) % 360
}

function buildDemoPath(geometry?: NavigationSession['routeGeometry']): DemoRoutePath | null {
  if (!geometry?.coordinates?.length) return null
  const points = geometry.coordinates
    .filter((coordinate): coordinate is [number, number] => coordinate.length >= 2 && Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]))
    .map(([longitude, latitude]) => ({ longitude, latitude }))
  if (points.length < 2) return null
  const cumulativeMeters = [0]
  for (let index = 1; index < points.length; index += 1) {
    cumulativeMeters.push(cumulativeMeters[index - 1] + distanceMeters(points[index - 1], points[index]))
  }
  const totalMeters = cumulativeMeters[cumulativeMeters.length - 1]
  return totalMeters > 0 ? { points, cumulativeMeters, totalMeters } : null
}

function pointAtProgress(path: DemoRoutePath, progress: number): { point: Coordinate; heading: number } {
  const targetMeters = path.totalMeters * Math.min(1, Math.max(0, progress))
  let segmentIndex = 1
  while (segmentIndex < path.cumulativeMeters.length - 1 && path.cumulativeMeters[segmentIndex] < targetMeters) segmentIndex += 1
  const start = path.points[segmentIndex - 1]
  const end = path.points[segmentIndex]
  const segmentStart = path.cumulativeMeters[segmentIndex - 1]
  const segmentLength = Math.max(1, path.cumulativeMeters[segmentIndex] - segmentStart)
  const segmentProgress = Math.min(1, Math.max(0, (targetMeters - segmentStart) / segmentLength))
  return {
    point: {
      longitude: start.longitude + (end.longitude - start.longitude) * segmentProgress,
      latitude: start.latitude + (end.latitude - start.latitude) * segmentProgress,
    },
    heading: bearingDegrees(start, end),
  }
}

type MonitoringBounds = { north: number; south: number; east: number; west: number; limit: number }

function monitoringBounds(geometry?: NavigationSession['routeGeometry']): MonitoringBounds | null {
  const points = geometry?.coordinates.filter((point) => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))
  if (!points?.length) return null
  const longitudes = points.map(([longitude]) => longitude)
  const latitudes = points.map(([, latitude]) => latitude)
  const margin = 0.025
  return {
    north: Math.min(90, Math.max(...latitudes) + margin),
    south: Math.max(-90, Math.min(...latitudes) - margin),
    east: Math.min(180, Math.max(...longitudes) + margin),
    west: Math.max(-180, Math.min(...longitudes) - margin),
    limit: 100,
  }
}

export function HazardsScreen({ navigate }: { navigate: Navigate }) {
  const plan = loadRoutePlan()
  const selectedRouteId = loadHazardsRouteId()
  const navigationId = sessionStorage.getItem('floodline-navigation-session')
  const [navigationSession, setNavigationSession] = useState<NavigationSession | null>(null)
  const [areaIncidents, setAreaIncidents] = useState<MapIncident[]>([])
  useEffect(() => {
    if (!navigationId) return
    let active = true
    void navigationApi.get(navigationId).then((value) => {
      if (active) setNavigationSession(value)
    }).catch(() => undefined)
    return () => { active = false }
  }, [navigationId])
  const updatedRoute = navigationSession?.updates?.find((update) => update.status === 'SENT')?.route
  const route = updatedRoute ?? plan?.preview.routes.find((item) => item.id === selectedRouteId) ?? plan?.preview.routes.find((item) => item.recommended) ?? plan?.preview.routes[0]
  const routeIndex = route && plan ? plan.preview.routes.findIndex((item) => item.id === route.id) : 0
  const routeLabel = `Route ${String.fromCharCode(65 + Math.max(0, routeIndex))}`
  const hazards = route?.risk.incidents ?? []
  const routeMonitoringBounds = useMemo(() => monitoringBounds(route?.geometry), [route?.id, route?.geometry])
  const routeHazardIds = useMemo(() => new Set(hazards.map((hazard) => hazard.id)), [hazards])
  useEffect(() => {
    if (!routeMonitoringBounds) return
    let active = true
    void incidentsApi.map(routeMonitoringBounds).then((feed) => {
      if (active) setAreaIncidents(feed.data.filter((incident) => routeHazardIds.has(incident.id)))
    }).catch(() => {
      if (active) setAreaIncidents([])
    })
    return () => { active = false }
  }, [routeMonitoringBounds, routeHazardIds])
  const incidentLabels = useMemo(() => Object.fromEntries(hazards.map((hazard) => [hazard.id, hazard.locationName])), [hazards])
  return <RouteFlowCanvas routeGeometry={route?.geometry} routeCenter={plan?.origin} incidents={areaIncidents} incidentLabels={incidentLabels} showWarningMarkers destinationLabel={plan?.destinationLabel} onClose={() => navigate('route-results')}><section className="route-state-sheet hazards-sheet"><SheetHandle /><h1>{routeLabel}: {hazards.length} flood hazard{hazards.length === 1 ? '' : 's'}</h1>{hazards.length ? <div className="hazard-list">{hazards.map((hazard) => <HazardItem key={hazard.id} tone={hazard.severity === 'SEVERE' ? 'severe' : 'moderate'} title={hazard.locationName} severity={`${hazard.severity} flooding`} detail={`${hazard.confidenceLabel} confidence · ${Math.round(hazard.distanceMeters)} m from route`} />)}</div> : <p className="sheet-description">No currently known reports were returned for {routeLabel}. This is the lower reported-risk alternative in the current scenario.</p>}<div className="sheet-actions"><ScreenButton className="secondary-action" onClick={() => navigate('route-results')}>Back to routes</ScreenButton></div></section></RouteFlowCanvas>
}

export function RerouteScreen({ navigate }: { navigate: Navigate }) {
  const plan = loadRoutePlan()
  const route = plan?.preview.routes.find((item) => item.recommended) ?? plan?.preview.routes[0]
  return <RouteFlowCanvas routeGeometry={route?.geometry} routeCenter={plan?.origin} destinationLabel={plan?.destinationLabel} statusLabel="Route updated" onClose={() => navigate('hazards')}><section className="route-state-sheet reroute-sheet"><SheetHandle /><div className="sheet-title-row"><span className="danger-dot" /><h1>New flooding reported ahead</h1></div><p className="sheet-description">A lower reported flood-risk alternative may be available. Review the route options before continuing.</p><div className="sheet-actions"><ScreenButton className="primary-action" onClick={() => navigate('route-results')}>View route options</ScreenButton><ScreenButton className="text-action" onClick={() => navigate('active')}>Stay on current route</ScreenButton></div></section></RouteFlowCanvas>
}

export function ActiveRouteScreen({ navigate }: { navigate: Navigate }) {
  const [session, setSession] = useState<NavigationSession | null>(null); const [liveLocation, setLiveLocation] = useState<Coordinate>(); const [userHeading, setUserHeading] = useState<number>(); const [demoProgress, setDemoProgress] = useState(0.04); const [liveIncidents, setLiveIncidents] = useState<MapIncident[]>([]); const [liveWarning, setLiveWarning] = useState<OfficialWarning>(); const [error, setError] = useState(''); const [demoTriggerState, setDemoTriggerState] = useState<'idle' | 'triggering' | 'triggered' | 'error'>('idle'); const [demoTriggerError, setDemoTriggerError] = useState(''); const demoSpeedMultiplierRef = useRef(1); const id = sessionStorage.getItem('floodline-navigation-session'); const plan = loadRoutePlan()
  useEffect(() => { if (!id) { setError('No active navigation session was found.'); return }; let active = true; const refresh = () => { navigationApi.get(id).then((value) => { if (active) setSession(value) }).catch(() => { if (active) setError('Navigation session is no longer available.') }) }; refresh(); const timer = window.setInterval(refresh, 15_000); return () => { active = false; window.clearInterval(timer) } }, [id])
  useEffect(() => {
    if (env.demoMode || !navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLiveLocation({ longitude: position.coords.longitude, latitude: position.coords.latitude })
        if (typeof position.coords.heading === 'number' && Number.isFinite(position.coords.heading)) setUserHeading(position.coords.heading)
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 10_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])
  const stop = () => { if (!session) return; navigationApi.stop(session.id).then(() => navigate('home')).catch(() => setError('Navigation could not be ended.')) }
  const triggerDemoHazard = async () => { setDemoTriggerState('triggering'); setDemoTriggerError(''); try { await demoApi.triggerHazard(); setDemoTriggerState('triggered') } catch (requestError) { setDemoTriggerState('error'); if (requestError instanceof ApiError && requestError.status === 401) setDemoTriggerError('Sign in again to use the demo control.'); else if (requestError instanceof ApiError && requestError.status === 404) setDemoTriggerError('Demo mode is disabled or the seeded hazard is missing. Restart the API with DEMO_MODE=true, then run npm run demo:seed.'); else if (requestError instanceof ApiError && requestError.status === 429) setDemoTriggerError('Demo control is cooling down. Try again in a moment.'); else setDemoTriggerError('The API could not activate the demo hazard. Check that the backend and worker are running.') } }
  const latestUpdate = session?.updates?.find((update) => update.status === 'SENT')
  const fallbackRoute = plan?.preview.routes.find((item) => item.id === session?.routeId) ?? plan?.preview.routes.find((item) => item.recommended) ?? plan?.preview.routes[0]
  const activeRoute = latestUpdate?.route ?? fallbackRoute
  const routeGeometry = latestUpdate?.route.geometry ?? session?.routeGeometry ?? activeRoute?.geometry
  const routeGeometryKey = JSON.stringify(routeGeometry?.coordinates ?? [])
  const demoPath = useMemo(() => buildDemoPath(routeGeometry), [routeGeometryKey])
  const routeMonitoringBounds = useMemo(() => monitoringBounds(routeGeometry), [routeGeometryKey])
  const routeMonitoringKey = routeMonitoringBounds ? `${routeMonitoringBounds.north}:${routeMonitoringBounds.south}:${routeMonitoringBounds.east}:${routeMonitoringBounds.west}` : ''
  useEffect(() => {
    if (!routeMonitoringBounds) return
    let active = true
    const refreshMonitoring = async () => {
      try {
        const [feed, warnings] = await Promise.all([incidentsApi.map(routeMonitoringBounds), warningsApi.active()])
        if (!active) return
        setLiveIncidents(feed.data)
        setLiveWarning(warnings.data[0])
      } catch {
        // Monitoring is best-effort here; navigation itself remains available.
      }
    }
    void refreshMonitoring()
    const timer = window.setInterval(() => { void refreshMonitoring() }, 10_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [routeMonitoringKey])
  const demoPosition = env.demoMode && demoPath ? pointAtProgress(demoPath, demoProgress) : undefined
  const displayedLocation = demoPosition?.point ?? liveLocation ?? session?.origin ?? plan?.origin
  const displayedHeading = demoPosition?.heading ?? userHeading
  const routeDurationSeconds = latestUpdate?.route.durationSeconds ?? session?.route.durationSeconds ?? activeRoute?.durationSeconds
  const routeDistanceMeters = latestUpdate?.route.distanceMeters ?? session?.route.distanceMeters ?? activeRoute?.distanceMeters
  const nearestLiveIncident = displayedLocation && liveIncidents.length > 0
    ? liveIncidents.reduce((nearest, incident) => distanceMeters(displayedLocation, incident.coordinates) < distanceMeters(displayedLocation, nearest.coordinates) ? incident : nearest)
    : undefined
  const hazardAheadLabel = nearestLiveIncident && displayedLocation
    ? `${Math.max(1, Math.round(distanceMeters(displayedLocation, nearestLiveIncident.coordinates) / 1000))} km ahead`
    : undefined
  const demoSpeedMultiplier = nearestLiveIncident && displayedLocation
    ? distanceMeters(displayedLocation, nearestLiveIncident.coordinates) < 2500 ? 0.3 : distanceMeters(displayedLocation, nearestLiveIncident.coordinates) < 5000 ? 0.6 : 1
    : 1
  demoSpeedMultiplierRef.current = demoSpeedMultiplier
  const incidentLabels = useMemo(() => Object.fromEntries((activeRoute?.risk.incidents ?? []).map((incident) => [incident.id, incident.locationName])), [activeRoute])
  useEffect(() => {
    if (!env.demoMode || !demoPath) return
    setDemoProgress(0.04)
    const timer = window.setInterval(() => setDemoProgress((value) => Math.min(1, value + demoSpeedMultiplierRef.current / env.demoNavigationSeconds)), 1000)
    return () => window.clearInterval(timer)
  }, [demoPath, routeGeometryKey])
  const displayedDurationSeconds = env.demoMode && demoPosition && routeDurationSeconds
    ? Math.max(60, Math.round(routeDurationSeconds * (1 - demoProgress)))
    : routeDurationSeconds
  if (error) return <main className="screen-shell settings-screen"><section className="settings-state"><p>{error}</p><ScreenButton onClick={() => navigate('route-search')}>Plan a route</ScreenButton></section></main>
  return <RouteFlowCanvas noOverlay routeGeometry={routeGeometry} routeCenter={displayedLocation} destination={session?.destination ?? plan?.destination} userLocation={displayedLocation} incidents={liveIncidents} incidentLabels={incidentLabels} navigationMarker userHeading={displayedHeading} destinationLabel={plan?.destinationLabel ?? 'your destination'} durationSeconds={displayedDurationSeconds} distanceMeters={routeDistanceMeters} statusLabel={latestUpdate ? 'Route updated' : 'Route active'} routeUpdated={Boolean(latestUpdate)} updateMessage={latestUpdate ? 'Avoiding a reported flood hazard on your route.' : undefined} demoSimulation={env.demoMode}><ActiveRouteSheet durationSeconds={displayedDurationSeconds} distanceMeters={routeDistanceMeters} hazardCount={activeRoute?.risk.affectingIncidentCount ?? 0} monitoringIncidentCount={liveIncidents.length} officialWarning={liveWarning} riskIncidents={activeRoute?.risk.incidents} hazardAheadLabel={hazardAheadLabel} routeUpdated={Boolean(latestUpdate)} demoSimulation={env.demoMode} speedReduced={demoSpeedMultiplier < 1} progressPercent={env.demoMode ? demoProgress * 100 : undefined} demoTriggerState={demoTriggerState} demoTriggerError={demoTriggerError} onTriggerDemoHazard={env.demoMode ? triggerDemoHazard : undefined} onViewHazards={() => { if (activeRoute?.id) saveHazardsRouteId(activeRoute.id); navigate('hazards') }} onReportHazard={() => navigate('report')} onStop={stop} /></RouteFlowCanvas>
}
