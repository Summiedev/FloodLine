import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { locationsApi, routesApi, savedPlacesApi } from '../../api/services'
import { session } from '../../api/session'
import type { Coordinate, LocationResult, SavedPlace } from '../../api/types'
import type { Navigate } from '../../types'
import { Icon } from '../ui/Icon'
import { ScreenButton } from '../ui/ScreenButton'
import { FlowHeader, TimelineRail } from './RoutePrimitives'
import { saveRoutePlan } from './route-state'

function routeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'TIMEOUT' || error.status === 504) return 'The route provider took too long. Try again.'
    if (error.status === 429) return 'Route searches are temporarily limited. Try again shortly.'
    if (error.status >= 400 && error.status < 500) return 'Check the starting point and destination, then try again.'
  }
  return 'Routes are temporarily unavailable. Please try again.'
}

function locationError(code?: number): string {
  if (code === 1) return 'Location permission is blocked. Allow it in your browser settings, then try again.'
  if (code === 2) return 'Your device could not find a location. Check location services and try again.'
  return 'We could not find your location. Try again or choose a saved place.'
}

export function RouteSearchScreen({ navigate, onBack, sheet = false }: { navigate: Navigate; onBack: () => void; sheet?: boolean }) {
  const [origin, setOrigin] = useState<Coordinate | null>(null)
  const [originLabel, setOriginLabel] = useState('')
  const [destination, setDestination] = useState<LocationResult | null>(null)
  const [destinationQuery, setDestinationQuery] = useState('')
  const [results, setResults] = useState<LocationResult[]>([])
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const skipNextSearch = useRef(false)
  const searchRequest = useRef(0)

  useEffect(() => {
    if (!session.accessToken()) return
    savedPlacesApi.list().then((response) => setSavedPlaces(response.data)).catch(() => undefined)
  }, [])

  useEffect(() => {
    const requestId = ++searchRequest.current
    if (skipNextSearch.current) { skipNextSearch.current = false; setSearching(false); return }
    const query = destinationQuery.trim()
    if (query.length < 2) { setResults([]); setSearching(false); return }
    const timer = window.setTimeout(() => {
      setSearching(true)
      locationsApi.search(query, origin ?? undefined)
        .then((nextResults) => { if (requestId === searchRequest.current) setResults(nextResults) })
        .catch(() => { if (requestId === searchRequest.current) setError('Location search is unavailable right now.') })
        .finally(() => { if (requestId === searchRequest.current) setSearching(false) })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [destinationQuery, origin])

  const selectDestination = (result: LocationResult) => {
    skipNextSearch.current = true
    setDestination(result)
    setDestinationQuery(result.formattedAddress)
    setResults([])
    setError('')
  }

  const useCurrentLocation = () => {
    if (locating) return
    if (!navigator.geolocation) { setError('Location access is not available in this browser.'); return }
    setLocating(true)
    setError('')
    navigator.geolocation.getCurrentPosition(async (position) => {
      const point = { longitude: position.coords.longitude, latitude: position.coords.latitude }
      setOrigin(point)
      try { setOriginLabel((await locationsApi.reverse(point)).formattedAddress) } catch { setOriginLabel('Current location') }
      finally { setLocating(false) }
    }, (positionError) => {
      setLocating(false)
      setError(locationError(positionError.code))
    }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 })
  }

  const submit = async () => {
    if (!origin) { setError('Choose your starting point before showing routes.'); return }
    if (!destination) { setError('Select a destination from the search results first.'); return }
    setLoading(true)
    setError('')
    try {
      const preview = await routesApi.preview(origin, destination.coordinates)
      if (preview.routes.length === 0) { setError('No route was found for those locations. Try a nearby destination.'); return }
      saveRoutePlan({ origin, destination: destination.coordinates, destinationLabel: destination.formattedAddress, travelMode: 'DRIVING', preview })
      navigate('route-results')
    } catch (requestError) {
      setError(routeError(requestError))
    } finally { setLoading(false) }
  }

  return <main className={`screen-shell flow-shell ${sheet ? 'sheet-screen' : ''}`} aria-label="Choose a route destination">
    <FlowHeader title="Where are you going?" onBack={onBack} />
    <section className={`destination-form ${origin ? 'has-current-location' : ''}`}>
      <TimelineRail connected={Boolean(origin)} />
      <div className="destination-fields">
        <div className="route-location-section">
          <span className="field-label">Starting point</span>
          {origin ? <div className="current-location-card is-ready" role="status">
            <span className="location-status-icon"><Icon name="current-location.svg" /></span>
            <span className="current-location-copy"><strong>{originLabel || 'Current location'}</strong><small>GPS position ready</small></span>
            <ScreenButton className="change-location-button" onClick={useCurrentLocation} disabled={locating}>{locating ? 'Updating…' : 'Change'}</ScreenButton>
          </div> : <ScreenButton className="location-entry location-entry-primary" onClick={useCurrentLocation} disabled={locating} ariaBusy={locating}>
            <span className="location-status-icon"><Icon name="locate.svg" /></span>
            <span className="location-action-copy"><strong>{locating ? 'Finding your location…' : 'Use my current location'}</strong><small>{locating ? 'Waiting for device permission' : 'Start from where you are'}</small></span>
            <span className="location-action-arrow" aria-hidden="true">›</span>
          </ScreenButton>}
        </div>
        <label className="destination-input"><input autoFocus={Boolean(origin)} value={destinationQuery} onChange={(event) => { setDestinationQuery(event.target.value); setDestination(null); setError('') }} onKeyDown={(event) => { if (event.key === 'Enter' && results[0]) { event.preventDefault(); selectDestination(results[0]) } }} placeholder="Search road, landmark or place" /><Icon name="search.svg" /></label>
      </div>
    </section>
    {error && <p className="auth-error route-search-error" role="alert">{error}</p>}
    <section className="places-section">
      {searching && <p className="settings-state">Searching…</p>}
      {!searching && destinationQuery.trim().length >= 2 && results.length === 0 && !destination && <p className="settings-state">No matching locations found.</p>}
      {!searching && results.length > 0 && <div className="place-list">{results.map((result) => <button className="route-location-result" type="button" key={result.providerPlaceId} onClick={() => selectDestination(result)}><strong>{result.name}</strong><small>{result.formattedAddress}</small></button>)}</div>}
      {!destinationQuery && <><h2>Saved places</h2><div className="place-list">{savedPlaces.map((place) => <button className="route-location-result" type="button" key={place.id} onClick={() => selectDestination({ providerPlaceId: place.providerPlaceId || place.id, name: place.customLabel || place.type, formattedAddress: place.formattedAddress, coordinates: place.location })}><strong>{place.customLabel || place.type}</strong><small>{place.formattedAddress}</small></button>)}</div></>}
    </section>
    <ScreenButton className="settings-primary route-search-submit" disabled={loading || locating} onClick={submit}>{loading ? 'Finding routes…' : 'Show routes'}</ScreenButton>
  </main>
}
