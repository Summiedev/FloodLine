import type { ReactNode } from 'react'

export type Screen = 'landing' | 'home' | 'route-search' | 'route-results' | 'hazards' | 'reroute' | 'active' | 'report' | 'login' | 'register'
export type AssetName =
  | 'alerts-nav.svg' | 'back.svg' | 'bike.svg' | 'bus.svg' | 'car.svg'
  | 'current-location.svg' | 'hazard-marker.svg' | 'home.svg' | 'locate.svg'
  | 'map-nav.svg' | 'profile-nav.svg' | 'recent.svg' | 'report-nav.svg'
  | 'route-nav.svg' | 'route-path.svg' | 'route.svg' | 'search.svg'
  | 'severe.svg' | 'walk.svg' | 'warning.svg' | 'work.svg'
  | 'route-results-back.svg' | 'route-results-car.svg' | 'route-results-bus.svg'
  | 'route-results-bike.svg' | 'route-results-walk.svg' | 'route-results-path.svg'
  | 'route-results-hazard.svg' | 'report-back.svg' | 'report-flooded-road.svg'
  | 'report-road-blocked.svg' | 'report-blocked-drain.svg' | 'report-building-flooding.svg'
  | 'report-electrical.svg' | 'report-road-clear.svg' | 'report-selected-primary.svg'
  | 'report-selected-secondary.svg' | 'report-location-pin.svg' | 'report-camera.svg'
  | 'report-photo.png' | 'report-photo-remove.svg' | 'report-success.svg'

export type NavigateOptions = { sheet?: boolean }
export type Navigate = (screen: Screen, options?: NavigateOptions) => void
export type WithChildren = { children: ReactNode }
