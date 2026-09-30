import { useEffect, useRef, useState } from 'react'
import mapboxgl, { type GeoJSONSource, type Map as MapboxMap, type MapLayerMouseEvent } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { env } from '../../config/env'
import type { Coordinate, MapIncident, RouteCandidate } from '../../api/types'

type Bounds = { north: number; south: number; east: number; west: number }
type RouteGeometry = Pick<RouteCandidate, 'id' | 'geometry' | 'recommended'>

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

type FeatureCollection = {
  type: 'FeatureCollection'
  features: Array<IncidentFeature | RouteFeature>
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

function fitRouteBounds(map: MapboxMap, routes: RouteGeometry[]): void {
  const coordinates = routes.flatMap((route) => route.geometry.coordinates).filter((point) => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))
  if (coordinates.length < 2) return
  const bounds = coordinates.reduce((result, point) => result.extend([point[0], point[1]]), new mapboxgl.LngLatBounds([coordinates[0][0], coordinates[0][1]], [coordinates[0][0], coordinates[0][1]]))
  map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 500 })
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
  className = '',
  onIncidentClick,
  onViewportChange,
}: {
  center?: Coordinate
  incidents?: MapIncident[]
  routeGeometries?: RouteGeometry[]
  className?: string
  onIncidentClick?: (id: string) => void
  onViewportChange?: (bounds: Bounds) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const loadedRef = useRef(false)
  const [contextLost, setContextLost] = useState(false)
  const onViewportChangeRef = useRef(onViewportChange)
  const onIncidentClickRef = useRef(onIncidentClick)

  useEffect(() => { onViewportChangeRef.current = onViewportChange }, [onViewportChange])
  useEffect(() => { onIncidentClickRef.current = onIncidentClick }, [onIncidentClick])

  useEffect(() => {
    if (!env.mapboxAccessToken || !containerRef.current) return

    mapboxgl.accessToken = env.mapboxAccessToken
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [center.longitude, center.latitude],
      zoom: 12,
      attributionControl: true,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('webglcontextlost', () => setContextLost(true))
    map.on('webglcontextrestored', () => { setContextLost(false); map.resize(); map.triggerRepaint() })

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
      const routeSource = map.getSource('floodline-routes') as GeoJSONSource | undefined
      incidentSource?.setData(asMapGeoJson(incidentCollection(incidents)))
      routeSource?.setData(asMapGeoJson(routeCollection(routeGeometries)))
      fitRouteBounds(map, routeGeometries)
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
    const source = map.getSource('floodline-routes') as GeoJSONSource | undefined
    source?.setData(asMapGeoJson(routeCollection(routeGeometries)))
    fitRouteBounds(map, routeGeometries)
  }, [routeGeometries])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    map.flyTo({ center: [center.longitude, center.latitude], duration: 600 })
  }, [center.latitude, center.longitude])

  if (!env.mapboxAccessToken) {
    return <div className={`live-map live-map-fallback ${className}`} role="img" aria-label="FloodLine map unavailable"><div className="live-map-missing-token"><strong>Live map is not configured</strong><span>Add VITE_MAPBOX_ACCESS_TOKEN to the frontend environment.</span></div></div>
  }

  return <div ref={containerRef} className={`live-map ${className}`} role="application" aria-label="FloodLine live map">{contextLost && <div className="live-map-context-lost"><strong>Map graphics paused</strong><span>Your browser lost the map graphics context. Refresh the page or try Chrome/Edge with hardware acceleration enabled.</span></div>}</div>
}
