import { useEffect, useRef, useState } from 'react'
import mapboxgl, { type GeoJSONSource, type Map as MapboxMap, type MapLayerMouseEvent } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { env } from '../../config/env'
import type { Coordinate, MapIncident, RouteCandidate } from '../../api/types'

type Bounds = { north: number; south: number; east: number; west: number }
type RouteGeometry = Pick<RouteCandidate, 'id' | 'geometry' | 'recommended'>
type RouteFitPadding = number | { top: number; right: number; bottom: number; left: number }

type IncidentFeature = {
  type: 'Feature'
  id: string
  properties: { incidentId: string; severity: string }
  geometry: { type: 'Point'; coordinates: [number, number] }
}

type RouteFeature = {
  type: 'Feature'
  id: string
  properties: { routeId: string; recommended: boolean }
  geometry: { type: 'LineString'; coordinates: [number, number][] }
}

type UserLocationFeature = {
  type: 'Feature'
  id: 'floodline-user-location'
  properties: { kind: 'user-location' }
  geometry: { type: 'Point'; coordinates: [number, number] }
}

type FeatureCollection = {
  type: 'FeatureCollection'
  features: Array<IncidentFeature | RouteFeature | UserLocationFeature>
}

type MapGeoJson = Parameters<GeoJSONSource['setData']>[0]

const defaultCenter: Coordinate = { longitude: 3.3792, latitude: 6.5244 }
const emptyCollection: FeatureCollection = { type: 'FeatureCollection', features: [] }

function asMapGeoJson(value: FeatureCollection): MapGeoJson {
  return value as unknown as MapGeoJson
}

function incidentCollection(incidents: MapIncident[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: incidents.map((incident) => ({
      type: 'Feature',
      id: incident.id,
      properties: { incidentId: incident.id, severity: incident.severity },
      geometry: {
        type: 'Point',
        coordinates: [incident.coordinates.longitude, incident.coordinates.latitude],
      },
    })),
  }
}

function routeCollection(routes: RouteGeometry[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: routes.flatMap((route) => {
      const coordinates = route.geometry.coordinates
        .filter((point): point is [number, number] => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))
        .map((point) => [point[0], point[1]] as [number, number])
      return coordinates.length >= 2
        ? [{
            type: 'Feature' as const,
            id: route.id,
            properties: { routeId: route.id, recommended: route.recommended === true },
            geometry: { type: 'LineString' as const, coordinates },
          }]
        : []
    }),
  }
}

function userLocationCollection(location?: Coordinate): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: location
      ? [{
          type: 'Feature',
          id: 'floodline-user-location',
          properties: { kind: 'user-location' },
          geometry: { type: 'Point', coordinates: [location.longitude, location.latitude] },
        }]
      : [],
  }
}

function routeGeometrySignature(routes: RouteGeometry[]): string {
  return routes.map((route) => `${route.id}:${JSON.stringify(route.geometry.coordinates)}`).join('|')
}

function createIncidentWarningMarker(incident: MapIncident, label?: string): HTMLElement {
  const anchor = document.createElement('div')
  anchor.className = 'live-incident-warning-anchor'
  anchor.setAttribute('aria-label', label ? `Flood warning near ${label}` : `${incident.severity} flood warning`)
  const tooltip = document.createElement('span')
  tooltip.className = 'live-incident-warning-tooltip'
  const incidentTypeLabel = incident.incidentType.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
  tooltip.textContent = label ? `Warning · ${label}` : `${incidentTypeLabel} reported`
  const pin = document.createElement('span')
  pin.className = `live-incident-warning-pin live-incident-warning-pin-${incident.severity.toLowerCase()}`
  const pinDot = document.createElement('span')
  pinDot.className = 'live-incident-warning-pin-dot'
  pin.appendChild(pinDot)
  anchor.append(tooltip, pin)
  return anchor
}

function fitRouteBounds(map: MapboxMap, routes: RouteGeometry[], padding: RouteFitPadding = 80): void {
  const coordinates = routes.flatMap((route) => route.geometry.coordinates).filter((point) => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))
  if (coordinates.length < 2) return
  const bounds = coordinates.reduce((result, point) => result.extend([point[0], point[1]]), new mapboxgl.LngLatBounds([coordinates[0][0], coordinates[0][1]], [coordinates[0][0], coordinates[0][1]]))
  map.resize()
  map.fitBounds(bounds, { padding, maxZoom: 15, duration: 700, linear: false })
}

function boundsFromMap(map: MapboxMap): Bounds | null {
  const bounds = map.getBounds()
  if (!bounds) return null
  return {
    north: Math.min(90, bounds.getNorth()),
    south: Math.max(-90, bounds.getSouth()),
    east: Math.min(180, bounds.getEast()),
    west: Math.max(-180, bounds.getWest()),
  }
}

export function LiveMap({
  center = defaultCenter,
  incidents = [],
  routeGeometries = [],
  routeFitPadding = 80,
  userLocation,
  focusPoint,
  destination,
  navigationZoom,
  incidentLabels = {},
  navigationMarker = false,
  showWarningMarkers = false,
  userHeading,
  className = '',
  onIncidentClick,
  onViewportChange,
}: {
  center?: Coordinate
  incidents?: MapIncident[]
  routeGeometries?: RouteGeometry[]
  routeFitPadding?: RouteFitPadding
  userLocation?: Coordinate
  focusPoint?: Coordinate
  destination?: Coordinate
  navigationZoom?: number
  incidentLabels?: Record<string, string>
  navigationMarker?: boolean
  showWarningMarkers?: boolean
  userHeading?: number
  className?: string
  onIncidentClick?: (id: string) => void
  onViewportChange?: (bounds: Bounds) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const navigationMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const destinationMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const incidentWarningMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const loadedRef = useRef(false)
  const navigationFollowSuspendedRef = useRef(false)
  const [contextLost, setContextLost] = useState(false)
  const onViewportChangeRef = useRef(onViewportChange)
  const onIncidentClickRef = useRef(onIncidentClick)
  const routeSignature = routeGeometrySignature(routeGeometries)
  const routePaddingSignature = typeof routeFitPadding === 'number' ? String(routeFitPadding) : JSON.stringify(routeFitPadding)

  useEffect(() => { onViewportChangeRef.current = onViewportChange }, [onViewportChange])
  useEffect(() => { onIncidentClickRef.current = onIncidentClick }, [onIncidentClick])

  useEffect(() => {
    if (!env.mapboxAccessToken || !containerRef.current) return

    mapboxgl.accessToken = env.mapboxAccessToken
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [center.longitude, center.latitude],
      zoom: navigationZoom ?? 13,
      attributionControl: true,
      dragPan: true,
      scrollZoom: true,
      boxZoom: true,
      dragRotate: true,
      doubleClickZoom: true,
      touchPitch: true,
      touchZoomRotate: true,
      keyboard: true,
      cooperativeGestures: false,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right')
    map.on('webglcontextlost', () => setContextLost(true))
    map.on('webglcontextrestored', () => { setContextLost(false); map.resize(); map.triggerRepaint() })

    // Keep following the moving navigation marker until the user takes control
    // of the camera. Without this guard, every GPS/demo position update calls
    // flyTo and makes vertical panning feel locked to the route.
    const suspendNavigationFollow = () => {
      navigationFollowSuspendedRef.current = true
    }
    map.on('dragstart', suspendNavigationFollow)
    map.on('rotatestart', suspendNavigationFollow)
    map.on('pitchstart', suspendNavigationFollow)

    if (navigationMarker && userLocation) {
      const markerElement = document.createElement('div')
      markerElement.className = 'live-navigation-marker-anchor'
      const labelElement = document.createElement('span')
      labelElement.className = 'live-navigation-marker-label'
      labelElement.textContent = 'You are here'
      const pinElement = document.createElement('span')
      pinElement.className = 'live-navigation-marker'
      const arrowElement = document.createElement('span')
      arrowElement.className = 'live-navigation-marker-arrow'
      pinElement.appendChild(arrowElement)
      markerElement.append(labelElement, pinElement)
      navigationMarkerRef.current = new mapboxgl.Marker({
        element: markerElement,
        anchor: 'center',
        rotationAlignment: 'map',
        pitchAlignment: 'map',
      }).setLngLat([userLocation.longitude, userLocation.latitude]).setRotation(userHeading ?? 0).addTo(map)
    }

    if (destination) {
      const destinationElement = document.createElement('div')
      destinationElement.className = 'live-destination-marker-anchor'
      const destinationLabel = document.createElement('span')
      destinationLabel.className = 'live-destination-marker-label'
      destinationLabel.textContent = 'Destination'
      const destinationPin = document.createElement('span')
      destinationPin.className = 'live-destination-marker'
      destinationElement.append(destinationLabel, destinationPin)
      destinationMarkerRef.current = new mapboxgl.Marker({ element: destinationElement, anchor: 'bottom' })
        .setLngLat([destination.longitude, destination.latitude])
        .addTo(map)
    }

    const notifyViewport = () => {
      const bounds = boundsFromMap(map)
      if (bounds) onViewportChangeRef.current?.(bounds)
    }

    map.on('load', () => {
      loadedRef.current = true
      map.addSource('floodline-incidents', { type: 'geojson', data: asMapGeoJson(emptyCollection) })
      map.addLayer({
        id: 'floodline-incidents-halo',
        type: 'circle',
        source: 'floodline-incidents',
        paint: { 'circle-color': '#ffffff', 'circle-radius': 13, 'circle-opacity': 0.9 },
      })
      map.addLayer({
        id: 'floodline-incidents-points',
        type: 'circle',
        source: 'floodline-incidents',
        paint: {
          'circle-color': ['match', ['get', 'severity'], 'SEVERE', '#dc3545', 'HIGH', '#e86a3d', 'MODERATE', '#f59e42', '#159bd7'],
          'circle-radius': 9,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      })
      map.addSource('floodline-user-location', { type: 'geojson', data: asMapGeoJson(userLocationCollection(userLocation)) })
      map.addLayer({
        id: 'floodline-user-location-halo',
        type: 'circle',
        source: 'floodline-user-location',
        paint: { 'circle-color': '#ffffff', 'circle-radius': 13, 'circle-opacity': 0.95 },
      })
      map.addLayer({
        id: 'floodline-user-location-point',
        type: 'circle',
        source: 'floodline-user-location',
        paint: { 'circle-color': '#159bd7', 'circle-radius': 8, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
      })
      map.addSource('floodline-routes', { type: 'geojson', data: asMapGeoJson(emptyCollection) })
      map.addLayer({
        id: 'floodline-routes-other',
        type: 'line',
        source: 'floodline-routes',
        filter: ['==', ['get', 'recommended'], false],
        paint: { 'line-color': '#64748b', 'line-width': 5, 'line-opacity': 0.75 },
      })
      map.addLayer({
        id: 'floodline-routes-recommended',
        type: 'line',
        source: 'floodline-routes',
        filter: ['==', ['get', 'recommended'], true],
        paint: { 'line-color': '#159bd7', 'line-width': 6, 'line-opacity': 0.95 },
      })
      const incidentSource = map.getSource('floodline-incidents') as GeoJSONSource | undefined
      const userLocationSource = map.getSource('floodline-user-location') as GeoJSONSource | undefined
      const routeSource = map.getSource('floodline-routes') as GeoJSONSource | undefined
      incidentSource?.setData(asMapGeoJson(incidentCollection(incidents)))
      userLocationSource?.setData(asMapGeoJson(userLocationCollection(userLocation)))
      routeSource?.setData(asMapGeoJson(routeCollection(routeGeometries)))
      window.requestAnimationFrame(() => {
        if (navigationZoom) {
          const focus = userLocation ?? center
          map.easeTo({ center: [focus.longitude, focus.latitude], zoom: navigationZoom, duration: 450 })
        } else {
          fitRouteBounds(map, routeGeometries, routeFitPadding)
        }
      })
      map.on('click', 'floodline-incidents-points', (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0] as { properties?: Record<string, unknown> } | undefined
        const id = feature?.properties?.incidentId
        if (typeof id === 'string') onIncidentClickRef.current?.(id)
      })
      map.on('mouseenter', 'floodline-incidents-points', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'floodline-incidents-points', () => { map.getCanvas().style.cursor = '' })
      map.on('moveend', notifyViewport)
      notifyViewport()
    })

    return () => {
      loadedRef.current = false
      navigationMarkerRef.current?.remove()
      navigationMarkerRef.current = null
      destinationMarkerRef.current?.remove()
      destinationMarkerRef.current = null
      incidentWarningMarkersRef.current.forEach((marker) => marker.remove())
      incidentWarningMarkersRef.current.clear()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const source = map.getSource('floodline-incidents') as GeoJSONSource | undefined
    source?.setData(asMapGeoJson(incidentCollection(incidents)))
  }, [incidents])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const visibleIncidents = navigationMarker || showWarningMarkers ? incidents : []
    const visibleIds = new Set(visibleIncidents.map((incident) => incident.id))
    visibleIncidents.forEach((incident) => {
      const existing = incidentWarningMarkersRef.current.get(incident.id)
      if (existing) {
        existing.setLngLat([incident.coordinates.longitude, incident.coordinates.latitude])
        return
      }
      const marker = new mapboxgl.Marker({ element: createIncidentWarningMarker(incident, incidentLabels[incident.id]), anchor: 'bottom' })
        .setLngLat([incident.coordinates.longitude, incident.coordinates.latitude])
        .addTo(map)
      incidentWarningMarkersRef.current.set(incident.id, marker)
    })
    incidentWarningMarkersRef.current.forEach((marker, id) => {
      if (!visibleIds.has(id)) {
        marker.remove()
        incidentWarningMarkersRef.current.delete(id)
      }
    })
  }, [incidents, incidentLabels, navigationMarker, showWarningMarkers])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const source = map.getSource('floodline-user-location') as GeoJSONSource | undefined
    source?.setData(asMapGeoJson(userLocationCollection(userLocation)))
  }, [userLocation])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current || !focusPoint) return
    map.easeTo({ center: [focusPoint.longitude, focusPoint.latitude], zoom: 15, duration: 700 })
  }, [focusPoint?.latitude, focusPoint?.longitude])

  useEffect(() => {
    if (!navigationMarker || !userLocation) return
    const marker = navigationMarkerRef.current
    if (!marker) return
    marker.setLngLat([userLocation.longitude, userLocation.latitude])
    if (typeof userHeading === 'number' && Number.isFinite(userHeading)) marker.setRotation(userHeading)
  }, [navigationMarker, userHeading, userLocation])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !destination) return
    if (!destinationMarkerRef.current) {
      const destinationElement = document.createElement('div')
      destinationElement.className = 'live-destination-marker-anchor'
      const destinationLabel = document.createElement('span')
      destinationLabel.className = 'live-destination-marker-label'
      destinationLabel.textContent = 'Destination'
      const destinationPin = document.createElement('span')
      destinationPin.className = 'live-destination-marker'
      destinationElement.append(destinationLabel, destinationPin)
      destinationMarkerRef.current = new mapboxgl.Marker({ element: destinationElement, anchor: 'bottom' }).addTo(map)
    }
    destinationMarkerRef.current.setLngLat([destination.longitude, destination.latitude])
  }, [destination?.latitude, destination?.longitude])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const source = map.getSource('floodline-routes') as GeoJSONSource | undefined
    source?.setData(asMapGeoJson(routeCollection(routeGeometries)))
  }, [routeGeometries])

  useEffect(() => {
    if (!navigationMarker) navigationFollowSuspendedRef.current = false
  }, [navigationMarker])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current || !routeSignature) return
    window.requestAnimationFrame(() => {
      if (navigationZoom) {
        if (navigationFollowSuspendedRef.current) return
        const focus = userLocation ?? center
        map.easeTo({ center: [focus.longitude, focus.latitude], zoom: navigationZoom, duration: 450 })
      } else {
        fitRouteBounds(map, routeGeometries, routeFitPadding)
      }
    })
  }, [routeSignature, routePaddingSignature, navigationZoom, navigationMarker, userLocation?.latitude, userLocation?.longitude])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    if (navigationMarker && navigationFollowSuspendedRef.current) return
    map.easeTo({ center: [center.longitude, center.latitude], duration: navigationMarker ? 450 : 600 })
  }, [center.latitude, center.longitude, navigationMarker])

  if (!env.mapboxAccessToken) {
    return <div className={`live-map live-map-fallback ${className}`} role="img" aria-label="FloodLine map unavailable"><div className="live-map-missing-token"><strong>Live map is not configured</strong><span>Add VITE_MAPBOX_ACCESS_TOKEN to the frontend environment.</span></div></div>
  }

  return <div ref={containerRef} className={`live-map ${className}`} role="application" aria-label="FloodLine live map">{contextLost && <div className="live-map-context-lost"><strong>Map graphics paused</strong><span>Your browser lost the map graphics context. Refresh the page or try Chrome/Edge with hardware acceleration enabled.</span></div>}</div>
}
