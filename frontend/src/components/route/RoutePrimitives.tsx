import { useState, type ReactNode } from 'react'
import type { Coordinate, MapIncident, OfficialWarning, RouteCandidate, RouteRiskIncident } from '../../api/types'
import type { AssetName } from '../../types'
import { LiveMap } from '../map/LiveMap'
import { Icon } from '../ui/Icon'
import { ScreenButton } from '../ui/ScreenButton'

export function FlowHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <header className="flow-header"><ScreenButton className="back-button" onClick={onBack} ariaLabel="Go back"><Icon name="back.svg" /></ScreenButton><h1>{title}</h1></header>
}

export function TimelineRail({ connected }: { connected: boolean }) {
  return <div className={`timeline-rail ${connected ? 'is-connected' : ''}`} aria-hidden="true"><span className="timeline-start" />{connected && <><span className="timeline-line" /><Icon name="current-location.svg" /></>}</div>
}

export function RecentPlace({ title, subtitle }: { title: string; subtitle: string }) {
  return <ScreenButton className="place-row"><span className="place-icon"><Icon name="recent.svg" /></span><span className="place-copy"><strong>{title}</strong><small>{subtitle}</small></span></ScreenButton>
}

export function SavedPlace({ title, icon }: { title: string; icon: AssetName }) {
  return <ScreenButton className="place-row"><span className="place-icon"><Icon name={icon} /></span><span className="place-copy"><strong>{title}</strong></span></ScreenButton>
}

export function ModeTab({ icon, active }: { icon: AssetName; active?: boolean }) {
  return <ScreenButton className={`mode-tab ${active ? 'is-active' : ''}`}><Icon name={icon} /></ScreenButton>
}

type RouteFlowCanvasProps = {
  children: ReactNode
  routeUpdated?: boolean
  noOverlay?: boolean
  onClose?: () => void
  destinationLabel?: string
  durationSeconds?: number
  distanceMeters?: number
  updateMessage?: string
  routeGeometry?: RouteCandidate['geometry']
  routeCenter?: Coordinate
  destination?: Coordinate
  userLocation?: Coordinate
  incidents?: MapIncident[]
  incidentLabels?: Record<string, string>
  userHeading?: number
  navigationMarker?: boolean
  statusLabel?: string
  demoSimulation?: boolean
}

export function RouteFlowCanvas({ children, routeUpdated = false, noOverlay = false, onClose, destinationLabel = 'destination', durationSeconds, distanceMeters, updateMessage, routeGeometry, routeCenter, destination, userLocation, incidents = [], incidentLabels = {}, userHeading, navigationMarker = false, statusLabel = 'Alternative route active', demoSimulation = false }: RouteFlowCanvasProps) {
  const durationLabel = durationSeconds ? `${Math.max(1, Math.round(durationSeconds / 60))} min` : 'Route active'
  const distanceLabel = distanceMeters ? `${(distanceMeters / 1000).toFixed(1)} km` : ''
  const routeGeometries = routeGeometry ? [{ id: 'active-navigation-route', geometry: routeGeometry, recommended: true }] : []
  return <main className="screen-shell route-state-shell" aria-label="Live route monitoring"><LiveMap className="route-state-live-map" center={routeCenter} incidents={incidents} incidentLabels={incidentLabels} destination={destination} navigationZoom={navigationMarker ? 15.5 : undefined} userLocation={userLocation ?? routeCenter} navigationMarker={navigationMarker} userHeading={userHeading} routeGeometries={routeGeometries} routeFitPadding={{ top: 168, right: 44, bottom: 230, left: 44 }} /><div className="route-state-wash" /><div className="route-state-topbar"><ScreenButton className="map-close-button" ariaLabel="Close route" onClick={onClose}>×</ScreenButton><div className="route-summary-card"><span>To: {destinationLabel}</span><strong>{durationLabel} {distanceLabel && <em>· {distanceLabel}</em>}</strong></div></div><div className="route-state-pills"><span className="active-route-pill">{statusLabel}</span><span className="monitoring-pill"><i />FloodLine monitoring live</span>{demoSimulation && <span className="demo-navigation-pill">Demo GPS simulation</span>}</div>{routeUpdated && <div className="route-updated-banner"><span className="route-updated-icon">↗</span><div><strong>Route updated</strong><small>{updateMessage || 'A lower reported flood-risk route is available.'}</small></div></div>}{!noOverlay && <div className="route-state-backdrop" />}{children}</main>
}

export function SheetHandle() { return <div className="sheet-handle" aria-hidden="true" /> }

export function HazardItem({ tone, title, severity, detail }: { tone: 'severe' | 'moderate'; title: string; severity: string; detail: string }) {
  return <div className={`hazard-item hazard-item-${tone}`}><span className="hazard-item-icon"><Icon name={tone === 'severe' ? 'severe.svg' : 'warning.svg'} /></span><span className="hazard-item-copy"><strong>{title}</strong><span>{severity}</span><small>{detail}</small></span></div>
}

type ActiveRouteSheetProps = {
  durationSeconds?: number
  distanceMeters?: number
  hazardCount?: number
  monitoringIncidentCount?: number
  officialWarning?: OfficialWarning
  riskIncidents?: RouteRiskIncident[]
  hazardAheadLabel?: string
  routeUpdated?: boolean
  speedReduced?: boolean
  demoSimulation?: boolean
  progressPercent?: number
  demoTriggerState?: 'idle' | 'triggering' | 'triggered' | 'error'
  demoTriggerError?: string
  onTriggerDemoHazard?: () => void
  onViewHazards?: () => void
  onReportHazard?: () => void
  onStop?: () => void
}

export function ActiveRouteSheet({ durationSeconds, distanceMeters, hazardCount = 0, monitoringIncidentCount = 0, officialWarning, riskIncidents = [], hazardAheadLabel, routeUpdated = false, speedReduced = false, demoSimulation = false, progressPercent, demoTriggerState = 'idle', demoTriggerError, onTriggerDemoHazard, onViewHazards, onReportHazard, onStop }: ActiveRouteSheetProps) {
  const [collapsed, setCollapsed] = useState(false)
  const durationLabel = durationSeconds ? `${Math.max(1, Math.round(durationSeconds / 60))} min` : 'Route active'
  const distanceLabel = distanceMeters ? `${(distanceMeters / 1000).toFixed(1)} km` : ''
  const primaryHazard = riskIncidents[0]
  const sourceLabel = primaryHazard?.sourceType === 'OFFICIAL' ? 'an official warning' : 'a community report'
  return <section className={`route-state-sheet active-sheet ${collapsed ? 'is-collapsed' : ''}`}><SheetHandle /><div className="active-sheet-header"><div className="active-heading"><span className="success-check">✓</span><div><h1>Route Active</h1><p>{durationLabel} {distanceLabel && `· ${distanceLabel}`}</p></div></div><ScreenButton className="collapse-button" ariaLabel={collapsed ? 'Expand route status' : 'Collapse route status'} onClick={() => setCollapsed((value) => !value)}>⌃</ScreenButton></div>{!collapsed && <><div className="active-status-card">{speedReduced ? 'Approaching reported flooding. Slowing down while safer routes are checked.' : 'Proceeding with caution. Hazard monitoring active.'}</div>{demoSimulation && <div className="demo-navigation-note"><strong>Controlled demo movement</strong><span>The vehicle marker and ETA are simulated along this route for the presentation.</span>{typeof progressPercent === 'number' && <div className="demo-navigation-progress"><i style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }} /></div>}</div>}{demoSimulation && onTriggerDemoHazard && <div className="demo-trigger-card"><div><strong>Demo control</strong><span>Activate a controlled flood hazard ahead to demonstrate rerouting.</span></div><ScreenButton className="demo-trigger-button" onClick={onTriggerDemoHazard} disabled={demoTriggerState === 'triggering'}>{demoTriggerState === 'triggering' ? 'Activating…' : demoTriggerState === 'triggered' ? 'Hazard activated' : 'Trigger flood hazard'}</ScreenButton>{demoTriggerError && <small role="alert">{demoTriggerError}</small>}</div>}{officialWarning && <div className="live-warning-card"><span className="live-warning-icon"><Icon name="warning.svg" /></span><div><strong>Official flood warning</strong><span>{officialWarning.title}</span><small>{officialWarning.authority} · Published {new Date(officialWarning.issuedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></div></div>}{monitoringIncidentCount > 0 && <div className="live-monitoring-note"><span className="live-monitoring-dot" /><span>{monitoringIncidentCount} active flood report{monitoringIncidentCount === 1 ? '' : 's'} visible in this monitoring area</span></div>}{hazardCount > 0 && !routeUpdated && <div className="reroute-monitor-card"><span className="reroute-monitor-icon"><Icon name="route-results-hazard.svg" /></span><div><strong>Checking lower-risk routes</strong><span>Flooding reported {hazardAheadLabel ?? 'ahead'}.</span><small>{primaryHazard ? `Reported by ${sourceLabel} near ${primaryHazard.locationName}.` : 'FloodLine is evaluating route alternatives.'}</small><i className="reroute-monitor-progress" /></div></div>}{routeUpdated && <div className="reroute-monitor-card is-updated"><span className="reroute-monitor-icon"><Icon name="route.svg" /></span><div><strong>Lower-risk route active</strong><span>Avoiding reported flooding ahead.</span><small>FloodLine found a route alternative that meets the current travel-time policy.</small></div></div>}<div className={`active-hazard-summary ${hazardCount > 0 ? 'has-hazards' : ''}`}><span className="active-hazard-summary-dot" /><div><strong>{hazardCount > 0 ? `${hazardCount} reported flood hazard${hazardCount === 1 ? '' : 's'} on this route` : 'No currently known reports ahead'}</strong><small>{hazardCount > 0 ? 'Review the affected areas before continuing.' : 'FloodLine will monitor this route for new reports.'}</small></div></div>{(onViewHazards || onReportHazard) && <div className="active-sheet-actions">{onViewHazards && <ScreenButton className="secondary-action" onClick={onViewHazards}><Icon name="route-results-hazard.svg" /><span>View hazards</span></ScreenButton>}{onReportHazard && <ScreenButton className="text-action action-report" onClick={onReportHazard}><Icon name="report-nav.svg" /><span>Report flooding</span></ScreenButton>}</div>}{onStop && <ScreenButton className="secondary-action active-end-navigation" onClick={onStop}><Icon name="back.svg" /><span>End navigation</span></ScreenButton>}</>}</section>
}
