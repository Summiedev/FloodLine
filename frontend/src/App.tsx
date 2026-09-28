import type { PointerEvent, ReactNode } from 'react'
import { useRef, useState } from 'react'
import { LandingPage } from './components/landing/LandingPage'
import { HomeScreen } from './components/map/HomeScreen'
import { RouteResultsScreen } from './components/route/RouteResultsScreen'
import { RouteSearchScreen } from './components/route/RouteSearchScreen'
import { ActiveRouteScreen, HazardsScreen, RerouteScreen } from './components/route/RouteStateScreens'
import { ReportFlowScreen } from './components/report/ReportFlowScreen'
import { AuthScreen } from './components/auth/AuthScreen'
import { screenFromUrl, screenUrl } from './lib/routing'
import type { Navigate, NavigateOptions, Screen } from './types'

function ScreenTransition({ screen, animation, children }: { screen: Screen; animation: string; children: ReactNode }) {
  return <div key={screen} className={`screen-transition ${animation}`}>{children}</div>
}

function RouteSearchSheet({ navigate, closing, expanded, onClose, onExpand }: { navigate: Navigate; closing: boolean; expanded: boolean; onClose: () => void; onExpand: () => void }) {
  const startY = useRef<number | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    startY.current = event.clientY
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (startY.current === null || expanded) return
    const distance = startY.current - event.clientY
    setDragOffset(Math.max(0, Math.min(distance, window.innerHeight * 0.52)))
  }

  const handlePointerUp = () => {
    if (startY.current !== null && dragOffset > 48) onExpand()
    startY.current = null
    setDragOffset(0)
    setDragging(false)
  }

  const handleClick = () => {
    if (!expanded && !dragging) onExpand()
  }

  return <><div className={`route-sheet-backdrop ${closing ? 'is-closing' : ''}`} onClick={onClose} /><div className={`route-sheet ${expanded ? 'is-expanded' : 'is-half'} ${dragging ? 'is-dragging' : ''}`} style={dragOffset && !expanded ? { transform: `translateY(-${dragOffset}px)` } : undefined}><div className="route-sheet-drag-handle" onClick={handleClick} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} role="button" tabIndex={0} aria-label="Expand route search"><span /></div><RouteSearchScreen navigate={navigate} onBack={onClose} sheet /></div></>
}

function App() {
  const [screen, setScreen] = useState<Screen>(() => screenFromUrl())
  const [routeSheet, setRouteSheet] = useState(() => screenFromUrl() === 'route-search')
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [sheetClosing, setSheetClosing] = useState(false)
  const [screenTransition, setScreenTransition] = useState('screen-enter-forward')

  const navigate: Navigate = (nextScreen: Screen, options?: NavigateOptions) => {
    if (options?.sheet || nextScreen === 'route-search') {
      setSheetClosing(false)
      setRouteSheet(true)
      setSheetExpanded(false)
      setScreen(nextScreen)
      window.history.pushState({}, '', screenUrl(nextScreen))
      return
    }
    setScreenTransition(nextScreen === 'landing' || nextScreen === 'home' ? 'screen-enter-back' : 'screen-enter-forward')
    setRouteSheet(false)
    setScreen(nextScreen)
    window.history.pushState({}, '', screenUrl(nextScreen))
  }

  const closeRouteSheet = () => {
    setSheetClosing(true)
    window.setTimeout(() => {
      setSheetClosing(false)
      setRouteSheet(false)
      setSheetExpanded(false)
      setScreen('home')
      window.history.pushState({}, '', screenUrl('home'))
    }, 260)
  }

  if (routeSheet && screen === 'route-search') return <><HomeScreen navigate={navigate} /><RouteSearchSheet navigate={navigate} closing={sheetClosing} expanded={sheetExpanded} onClose={closeRouteSheet} onExpand={() => setSheetExpanded(true)} /></>
  if (screen === 'landing') return <ScreenTransition screen={screen} animation={screenTransition}><LandingPage navigate={navigate} /></ScreenTransition>
  if (screen === 'route-search') return <ScreenTransition screen={screen} animation={screenTransition}><RouteSearchScreen navigate={navigate} onBack={() => navigate('home')} /></ScreenTransition>
  if (screen === 'route-results') return <ScreenTransition screen={screen} animation={screenTransition}><RouteResultsScreen navigate={navigate} /></ScreenTransition>
  if (screen === 'hazards') return <ScreenTransition screen={screen} animation={screenTransition}><HazardsScreen navigate={navigate} /></ScreenTransition>
  if (screen === 'reroute') return <ScreenTransition screen={screen} animation={screenTransition}><RerouteScreen navigate={navigate} /></ScreenTransition>
  if (screen === 'active') return <ScreenTransition screen={screen} animation={screenTransition}><ActiveRouteScreen navigate={navigate} /></ScreenTransition>
  if (screen === 'report') return <ScreenTransition screen={screen} animation={screenTransition}><ReportFlowScreen navigate={navigate} /></ScreenTransition>
  if (screen === 'login') return <ScreenTransition screen={screen} animation={screenTransition}><AuthScreen mode="login" navigate={navigate} /></ScreenTransition>
  if (screen === 'register') return <ScreenTransition screen={screen} animation={screenTransition}><AuthScreen mode="register" navigate={navigate} /></ScreenTransition>
  return <ScreenTransition screen="home" animation={screenTransition}><HomeScreen navigate={navigate} /></ScreenTransition>
}

export default App
