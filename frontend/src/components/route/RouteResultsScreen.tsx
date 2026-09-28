import { Icon } from '../ui/Icon'
import { ScreenButton } from '../ui/ScreenButton'
import { asset } from '../../lib/assets'
import type { Navigate } from '../../types'
import { ModeTab } from './RoutePrimitives'

function RouteCard({ secondary = false, navigate }: { secondary?: boolean; navigate: Navigate }) {
  if (secondary) return <article className="route-card route-card-secondary"><div className="route-card-head"><div><h2>Route B</h2><span>25 min</span><strong>Active flood reports</strong></div><span className="flood-report-badge"><i />Flood reports</span></div><p>2 reported hazards along this route.</p><ScreenButton className="route-card-link" onClick={() => navigate('hazards')}>View hazards</ScreenButton></article>
  return <article className="route-card route-card-primary"><span className="recommended-badge">Recommended</span><div className="route-card-head"><div><h2>Route A</h2><span>31 min</span><strong>Low reported flood risk</strong></div><span className="lower-risk-badge"><i />Lower risk</span></div><p>Avoids 3 active flood reports.</p><ScreenButton className="start-navigation" onClick={() => navigate('active')}>Start Navigation</ScreenButton></article>
}

export function RouteResultsScreen({ navigate }: { navigate: Navigate }) {
  return <main className="screen-shell results-shell" aria-label="Route options to ICM"><header className="results-header"><ScreenButton className="back-button" onClick={() => navigate('route-search')} ariaLabel="Go back"><Icon name="route-results-back.svg" /></ScreenButton><div className="results-heading"><span>To: ICM</span><div className="mode-tabs"><ModeTab icon="route-results-car.svg" active /><ModeTab icon="route-results-bus.svg" /><ModeTab icon="route-results-bike.svg" /><ModeTab icon="route-results-walk.svg" /></div></div></header><section className="route-map-area"><div className="route-map-image" /><div className="route-map-wash" /><img className="route-path" src={asset('route-results-path.svg')} alt="" aria-hidden="true" /><span className="map-current-dot" /><span className="map-route-dot" /><span className="map-hazard"><Icon name="route-results-hazard.svg" /></span><div className="routes-stack"><RouteCard navigate={navigate} /><RouteCard secondary navigate={navigate} /></div></section></main>
}
