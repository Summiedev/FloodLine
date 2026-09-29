import type { Coordinate, RoutePreview } from '../../api/types'

const key = 'floodline-route-preview'
export type RoutePlan = { origin: Coordinate; destination: Coordinate; destinationLabel: string; travelMode: 'DRIVING' | 'TRANSIT' | 'CYCLING' | 'WALKING'; preview: RoutePreview }
export function saveRoutePlan(plan: RoutePlan): void { sessionStorage.setItem(key, JSON.stringify(plan)) }
export function loadRoutePlan(): RoutePlan | null { const value = sessionStorage.getItem(key); if (!value) return null; try { return JSON.parse(value) as RoutePlan } catch { return null } }
export function clearRoutePlan(): void { sessionStorage.removeItem(key) }
