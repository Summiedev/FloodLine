import { useState, type ReactNode } from 'react'
import { Icon } from '../ui/Icon'
import { ScreenButton } from '../ui/ScreenButton'
import { asset } from '../../lib/assets'
import type { AssetName } from '../../types'

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

export function RouteFlowCanvas({ children, routeUpdated = false, noOverlay = false, onClose }: { children: ReactNode; routeUpdated?: boolean; noOverlay?: boolean; onClose?: () => void }) {
  return (
    <main className="screen-shell route-state-shell" aria-label="Live route monitoring">
      <div className="route-state-map" /><div className="route-state-wash" /><img className="route-state-path" src={asset('route-path.svg')} alt="" aria-hidden="true" />
      <span className="route-state-current" /><span className="route-state-destination" />
      <div className="route-state-topbar"><ScreenButton className="map-close-button" ariaLabel="Close route" onClick={onClose}>×</ScreenButton><div className="route-summary-card"><span>To: ICM</span><strong>25 min <em>• 15.9 km</em></strong></div></div>
      <div className="route-state-pills"><span className="active-route-pill">Alternative route active</span><span className="monitoring-pill"><i />FloodLine monitoring live</span></div>
      {routeUpdated && <div className="route-updated-banner"><span className="route-updated-icon">↗</span><div><strong>Route updated</strong><small>Avoiding reported flooding on Admiralty Way.</small></div></div>}
      {!noOverlay && <div className="route-state-backdrop" />}
      {children}
    </main>
  )
}

export function SheetHandle() { return <div className="sheet-handle" aria-hidden="true" /> }

export function HazardItem({ tone, title, severity, detail }: { tone: 'severe' | 'moderate'; title: string; severity: string; detail: string }) {
  return <div className={`hazard-item hazard-item-${tone}`}><span className="hazard-item-icon"><Icon name={tone === 'severe' ? 'severe.svg' : 'warning.svg'} /></span><span className="hazard-item-copy"><strong>{title}</strong><span>{severity}</span><small>{detail}</small></span></div>
}

export function ActiveRouteSheet() {
  const [collapsed, setCollapsed] = useState(false)
  return <section className={`route-state-sheet active-sheet ${collapsed ? 'is-collapsed' : ''}`}><SheetHandle /><div className="active-sheet-header"><div className="active-heading"><span className="success-check">✓</span><div><h1>Route Active</h1><p>25 min • 15.9 km</p></div></div><ScreenButton className="collapse-button" ariaLabel={collapsed ? 'Expand route status' : 'Collapse route status'} onClick={() => setCollapsed((value) => !value)}>⌃</ScreenButton></div>{!collapsed && <div className="active-status-card">Proceeding with caution. Hazard monitoring active.</div>}</section>
}
