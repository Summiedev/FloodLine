import { Icon } from '../ui/Icon'
import { ScreenButton } from '../ui/ScreenButton'
import type { AssetName, Navigate } from '../../types'

const items: Array<{ label: string; icon: AssetName; screen: 'home' | 'route-search' | 'report' | 'login' }> = [
  { label: 'Map', icon: 'map-nav.svg', screen: 'home' },
  { label: 'Route', icon: 'route-nav.svg', screen: 'route-search' },
  { label: 'Report', icon: 'report-nav.svg', screen: 'report' },
  { label: 'Alerts', icon: 'alerts-nav.svg', screen: 'home' },
  { label: 'Profile', icon: 'profile-nav.svg', screen: 'login' },
]

export function BottomNav({ navigate }: { navigate: Navigate }) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {items.map((item) => item.label === 'Report' ? (
        <ScreenButton className="nav-item report-nav-item" key={item.label} onClick={() => navigate(item.screen)}>
          <span className="report-button"><Icon name={item.icon} /></span>
          <span>{item.label}</span>
        </ScreenButton>
      ) : (
        <ScreenButton className={`nav-item ${item.label === 'Map' ? 'is-active' : ''}`} key={item.label} onClick={() => navigate(item.screen, item.label === 'Route' ? { sheet: true } : undefined)}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </ScreenButton>
      ))}
    </nav>
  )
}
