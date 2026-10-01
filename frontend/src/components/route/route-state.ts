import type { Coordinate, RoutePreview } from '../../api/types'

const key = 'floodline-route-preview'
const hazardsRouteKey = 'floodline-hazards-route-id'
export type RoutePlan = { origin: Coordinate; destination: Coordinate; destinationLabel: string; travelMode: 'DRIVING' | 'TRANSIT' | 'CYCLING' | 'WALKING'; preview: RoutePreview }
export function saveRoutePlan(plan: RoutePlan): void { sessionStorage.setItem(key, JSON.stringify(plan)); sessionStorage.removeItem(hazardsRouteKey) }
export function loadRoutePlan(): RoutePlan | null { const value = sessionStorage.getItem(key); if (!value) return null; try { return JSON.parse(value) as RoutePlan } catch { return null } }
export function clearRoutePlan(): void { sessionStorage.removeItem(key) }
export function saveHazardsRouteId(routeId: string): void { sessionStorage.setItem(hazardsRouteKey, routeId) }
export function loadHazardsRouteId(): string | null { return sessionStorage.getItem(hazardsRouteKey) }
