import { BottomNav } from '../navigation/BottomNav'
import { Icon } from '../ui/Icon'
import { ScreenButton } from '../ui/ScreenButton'
import { SearchBar, WarningBanner } from './MapControls'
import type { Navigate } from '../../types'

export function HomeScreen({ navigate }: { navigate: Navigate }) {
  return (
    <main className="screen-shell map-shell" aria-label="FloodLine home map">
      <div className="map-image" />
      <div className="map-wash" />
      <div className="home-content">
        <div className="map-top-controls">
          <SearchBar onClick={() => navigate('route-search', { sheet: true })} />
          <ScreenButton className="locate-button" ariaLabel="Use current location"><Icon name="locate.svg" /></ScreenButton>
        </div>
        <div className="warning-wrap"><WarningBanner /></div>
        <div className="map-open-space">
          <div className="severity-marker">
            <span className="severity-dot"><Icon name="severe.svg" /></span>
            <span className="severity-label">Severe</span>
          </div>
          <ScreenButton className="plan-route-pill" onClick={() => navigate('route-search', { sheet: true })}>
            <Icon name="route.svg" />
            <strong>Plan Safe Route</strong>
          </ScreenButton>
        </div>
      </div>
      <BottomNav navigate={navigate} />
    </main>
  )
}
