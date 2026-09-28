import { ScreenButton } from '../ui/ScreenButton'
import type { Navigate } from '../../types'
import { ActiveRouteSheet, HazardItem, RouteFlowCanvas, SheetHandle } from './RoutePrimitives'

export function HazardsScreen({ navigate }: { navigate: Navigate }) {
  return <RouteFlowCanvas onClose={() => navigate('route-results')}><section className="route-state-sheet hazards-sheet"><SheetHandle /><h1>2 flood hazards on this route</h1><div className="hazard-list"><HazardItem tone="severe" title="Admiralty Way" severity="Severe flooding" detail="14 confirmations • Updated 3 min ago" /><HazardItem tone="moderate" title="Lekki-Epe Expressway" severity="Moderate flooding" detail="5 confirmations • Updated 8 min ago" /></div><div className="sheet-actions"><ScreenButton className="primary-action" onClick={() => navigate('reroute')}>Take Lower-Risk Route</ScreenButton><ScreenButton className="secondary-action" onClick={() => navigate('active')}>Continue with this route</ScreenButton></div></section></RouteFlowCanvas>
}

export function RerouteScreen({ navigate }: { navigate: Navigate }) {
  return <RouteFlowCanvas onClose={() => navigate('hazards')}><section className="route-state-sheet reroute-sheet"><SheetHandle /><div className="sheet-title-row"><span className="danger-dot" /><h1>New flooding reported ahead</h1></div><p className="sheet-description">1.2 km away on your current route. Reported by 2 people in the last 3 minutes.</p><div className="new-route-card"><div><strong>New route found</strong><span>Avoids reported flooding completely.</span></div><b>+6 min</b></div><div className="sheet-actions"><ScreenButton className="primary-action" onClick={() => navigate('active')}>Use New Route</ScreenButton><ScreenButton className="secondary-action" onClick={() => navigate('hazards')}>View Report</ScreenButton><ScreenButton className="text-action" onClick={() => navigate('active')}>Stay on current route</ScreenButton></div></section></RouteFlowCanvas>
}

export function ActiveRouteScreen({ navigate }: { navigate: Navigate }) {
  return <RouteFlowCanvas routeUpdated noOverlay onClose={() => navigate('route-results')}><ActiveRouteSheet /></RouteFlowCanvas>
}
