import type { Screen } from '../types'

export function screenFromUrl(): Screen {
  const screen = new URLSearchParams(window.location.search).get('screen')
  return screen === 'landing' || screen === 'home' || screen === 'route-search' || screen === 'route-results' || screen === 'hazards' || screen === 'reroute' || screen === 'active' || screen === 'report' || screen === 'login' || screen === 'register' || screen === 'saved-places' || screen === 'alert-radius' || screen === 'alert-types' || screen === 'notification-settings' || screen === 'alerts' || screen === 'profile' ? screen : 'landing'
}

export function screenUrl(screen: Screen) {
  return screen === 'landing' ? window.location.pathname : `${window.location.pathname}?screen=${screen}`
}

const authenticatedScreens: ReadonlySet<Screen> = new Set([
  'report',
  'active',
  'saved-places',
  'alert-radius',
  'alert-types',
  'notification-settings',
  'alerts',
  'profile',
])

export function requiresAuthentication(screen: Screen): boolean {
  return authenticatedScreens.has(screen)
}
