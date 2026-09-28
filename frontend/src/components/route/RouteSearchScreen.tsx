import { useState } from 'react'
import { Icon } from '../ui/Icon'
import { ScreenButton } from '../ui/ScreenButton'
import type { Navigate } from '../../types'
import { FlowHeader, RecentPlace, SavedPlace, TimelineRail } from './RoutePrimitives'

export function RouteSearchScreen({ navigate, onBack, sheet = false }: { navigate: Navigate; onBack: () => void; sheet?: boolean }) {
  const [currentQuery, setCurrentQuery] = useState('')
  const [currentLocation, setCurrentLocation] = useState<string | null>(null)
  const [destinationQuery, setDestinationQuery] = useState('')
  const confirmCurrentLocation = () => { const value = currentQuery.trim(); if (value) setCurrentLocation(value) }
  const submitDestination = () => { if (destinationQuery.trim()) navigate('route-results') }

  return <main className={`screen-shell flow-shell ${sheet ? 'sheet-screen' : ''}`} aria-label="Choose a route destination">
    <FlowHeader title="Where are you going?" onBack={onBack} />
    <section className={`destination-form ${currentLocation ? 'has-current-location' : ''}`}><TimelineRail connected={Boolean(currentLocation)} /><div className="destination-fields">
      {currentLocation ? <div className="current-location-card selected-location-card"><span>Current Location</span><strong>{currentLocation}</strong></div> : <label className="location-entry"><input autoFocus={sheet} value={currentQuery} onChange={(event) => setCurrentQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') confirmCurrentLocation() }} placeholder="Search your current location" /><ScreenButton className="location-confirm" onClick={confirmCurrentLocation}>Use location</ScreenButton></label>}
      {currentLocation && <label className="destination-input"><input autoFocus value={destinationQuery} onChange={(event) => setDestinationQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitDestination() }} placeholder="Search road, landmark or place" /><Icon name="search.svg" /></label>}
    </div></section>
    <section className="places-section"><h2>Recent</h2><div className="place-list"><RecentPlace title="Murtala Muhammed Airport" subtitle="Ikeja" /><RecentPlace title="Victoria Island" subtitle="Lagos" /><RecentPlace title="Ikeja City Mall" subtitle="Obafemi Awolowo Way" /></div><h2 className="saved-heading">Saved</h2><div className="place-list"><SavedPlace title="Home" icon="home.svg" /><SavedPlace title="Work" icon="work.svg" /></div></section>
  </main>
}
