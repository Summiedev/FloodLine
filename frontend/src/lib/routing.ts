import type { Screen } from '../types'

export function screenFromUrl(): Screen {
  const screen = new URLSearchParams(window.location.search).get('screen')
  return screen === 'landing' || screen === 'home' || screen === 'route-search' || screen === 'route-results' || screen === 'hazards' || screen === 'reroute' || screen === 'active' || screen === 'report' || screen === 'login' || screen === 'register' ? screen : 'landing'
}

export function screenUrl(screen: Screen) {
  return screen === 'landing' ? window.location.pathname : `${window.location.pathname}?screen=${screen}`
}
