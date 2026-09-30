import type { PointerEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { LandingPage } from './components/landing/LandingPage'
import { HomeScreen } from './components/map/HomeScreen'
import { RouteResultsScreen } from './components/route/RouteResultsScreen'
import { RouteSearchScreen } from './components/route/RouteSearchScreen'
import { ActiveRouteScreen, HazardsScreen, RerouteScreen } from './components/route/RouteStateScreens'
import { ReportFlowScreen } from './components/report/ReportFlowScreen'
import { AuthScreen } from './components/auth/AuthScreen'
import { screenFromUrl, screenUrl } from './lib/routing'
import type { Navigate, NavigateOptions, Screen } from './types'
import { ProfileScreen } from './components/settings/SettingsScreens'
import { AlertsScreen } from './components/settings/AlertsScreen'
import { AlertRadiusScreen } from './components/settings/AlertRadiusScreen'
import { AlertTypesScreen } from './components/settings/AlertTypesScreen'
import { NotificationSettingsScreen } from './components/settings/NotificationSettingsScreen'
import { SavedPlacesScreen } from './components/settings/SavedPlacesScreen'
import { AuthRequiredModal } from './components/auth/AuthRequiredModal'
import { session } from './api/session'
import { requiresAuthentication } from './lib/routing'

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
  const initialScreen = screenFromUrl()
  const initialAuthRequired = requiresAuthentication(initialScreen) && !session.accessToken()
  const [screen, setScreen] = useState<Screen>(() => initialAuthRequired ? 'home' : initialScreen)
  const [authPrompt, setAuthPrompt] = useState<Screen | null>(() => initialAuthRequired ? initialScreen : null)
  const [routeSheet, setRouteSheet] = useState(() => !initialAuthRequired && initialScreen === 'route-search')
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [sheetClosing, setSheetClosing] = useState(false)
  const [screenTransition, setScreenTransition] = useState('screen-enter-forward')
  const [authReturnTo, setAuthReturnTo] = useState<Screen>('home')

  const requestAuthentication = (target: Screen, returnTo: Screen = 'home') => {
    setAuthReturnTo(returnTo)
    setAuthPrompt(target)
    setRouteSheet(false)
    setSheetExpanded(false)
    setScreen('home')
    window.history.pushState({}, '', screenUrl('home'))
  }

  useEffect(() => {
    if (initialAuthRequired) window.history.replaceState({}, '', screenUrl('home'))
  }, [initialAuthRequired])

  const navigate: Navigate = (nextScreen: Screen, options?: NavigateOptions) => {
    if (requiresAuthentication(nextScreen) && !session.accessToken()) {
      requestAuthentication(nextScreen)
      return
    }
    if (nextScreen !== 'login' && nextScreen !== 'register') setAuthReturnTo('home')
    setAuthPrompt(null)
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

  let page: ReactNode
  if (routeSheet && screen === 'route-search') page = <><HomeScreen navigate={navigate} onRequireAuth={() => requestAuthentication('report')} /><RouteSearchSheet navigate={navigate} closing={sheetClosing} expanded={sheetExpanded} onClose={closeRouteSheet} onExpand={() => setSheetExpanded(true)} /></>
  else if (screen === 'landing') page = <ScreenTransition screen={screen} animation={screenTransition}><LandingPage navigate={navigate} /></ScreenTransition>
  else if (screen === 'route-search') page = <ScreenTransition screen={screen} animation={screenTransition}><RouteSearchScreen navigate={navigate} onBack={() => navigate('home')} /></ScreenTransition>
  else if (screen === 'route-results') page = <ScreenTransition screen={screen} animation={screenTransition}><RouteResultsScreen navigate={navigate} onRequireAuth={() => requestAuthentication('active', 'route-results')} /></ScreenTransition>
  else if (screen === 'hazards') page = <ScreenTransition screen={screen} animation={screenTransition}><HazardsScreen navigate={navigate} /></ScreenTransition>
  else if (screen === 'reroute') page = <ScreenTransition screen={screen} animation={screenTransition}><RerouteScreen navigate={navigate} /></ScreenTransition>
  else if (screen === 'active') page = <ScreenTransition screen={screen} animation={screenTransition}><ActiveRouteScreen navigate={navigate} /></ScreenTransition>
  else if (screen === 'report') page = <ScreenTransition screen={screen} animation={screenTransition}><ReportFlowScreen navigate={navigate} /></ScreenTransition>
  else if (screen === 'login') page = <ScreenTransition screen={screen} animation={screenTransition}><AuthScreen mode="login" navigate={navigate} afterAuth={authReturnTo} /></ScreenTransition>
  else if (screen === 'register') page = <ScreenTransition screen={screen} animation={screenTransition}><AuthScreen mode="register" navigate={navigate} afterAuth={authReturnTo} /></ScreenTransition>
  else if (screen === 'saved-places') page = <ScreenTransition screen={screen} animation={screenTransition}><SavedPlacesScreen navigate={navigate} /></ScreenTransition>
  else if (screen === 'alert-radius') page = <ScreenTransition screen={screen} animation={screenTransition}><AlertRadiusScreen navigate={navigate} /></ScreenTransition>
  else if (screen === 'alert-types') page = <ScreenTransition screen={screen} animation={screenTransition}><AlertTypesScreen navigate={navigate} /></ScreenTransition>
  else if (screen === 'notification-settings') page = <ScreenTransition screen={screen} animation={screenTransition}><NotificationSettingsScreen navigate={navigate} /></ScreenTransition>
  else if (screen === 'alerts') page = <ScreenTransition screen={screen} animation={screenTransition}><AlertsScreen navigate={navigate} /></ScreenTransition>
  else if (screen === 'profile') page = <ScreenTransition screen={screen} animation={screenTransition}><ProfileScreen navigate={navigate} /></ScreenTransition>
  else page = <ScreenTransition screen="home" animation={screenTransition}><HomeScreen navigate={navigate} onRequireAuth={() => requestAuthentication('report')} /></ScreenTransition>

  return <>{page}{authPrompt && <AuthRequiredModal onClose={() => { setAuthPrompt(null); setAuthReturnTo('home') }} onSignIn={() => { setAuthPrompt(null); navigate('login') }} onRegister={() => { setAuthPrompt(null); navigate('register') }} />}</>
}

export default App
