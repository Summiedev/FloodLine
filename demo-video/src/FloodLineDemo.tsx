import { AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame } from 'remotion'
import type { CSSProperties, ReactNode } from 'react'
import { scenario, type Coordinate, type ScenarioIncident } from './scenario'

const colors = {
  ink: '#10233e',
  body: '#50627a',
  muted: '#71829a',
  line: '#dce6ef',
  water: '#159bd7',
  deepWater: '#0876a8',
  mist: '#e7f6fc',
  red: '#dc3545',
  orange: '#ee8a2f',
  green: '#24ae70',
  gold: '#d99522',
}

const font = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const sceneFrames = {
  landing: 150,
  overview: 300,
  warning: 300,
  planning: 300,
  comparison: 300,
  navigation: 360,
  trigger: 330,
  reroute: 240,
  alerts: 120,
} as const

function fade(frame: number, duration: number): number {
  return interpolate(frame, [0, 18, duration - 18, duration], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
}

function SceneFrame({ frame, duration, kicker, title, children, dark = false }: { frame: number; duration: number; kicker: string; title: string; children: ReactNode; dark?: boolean }) {
  const opacity = fade(frame, duration)
  const enter = interpolate(frame, [0, 24], [24, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  return <AbsoluteFill style={{ opacity, transform: `translateY(${enter}px)`, background: dark ? colors.ink : '#f8fbfd', color: dark ? '#fff' : colors.ink, fontFamily: font }}>
    <div style={{ position: 'absolute', top: 46, left: 72, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 42, height: 42, borderRadius: 14, display: 'grid', placeItems: 'center', background: dark ? 'rgba(255,255,255,.12)' : colors.mist, color: dark ? '#fff' : colors.water, fontWeight: 900, fontSize: 19 }}>F</div>
      <span style={{ fontSize: 20, fontWeight: 850, letterSpacing: '-.02em' }}>FloodLine</span>
      <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 800, letterSpacing: '.15em', textTransform: 'uppercase', opacity: .6 }}>Controlled demo</span>
    </div>
    <div style={{ position: 'absolute', top: 54, right: 72, fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', opacity: .58 }}>{kicker}</div>
    <div style={{ position: 'absolute', top: 146, right: 72, left: 72 }}>{children}</div>
    <div style={{ position: 'absolute', right: 72, bottom: 42, left: 72, display: 'flex', alignItems: 'center', gap: 14, opacity: .55 }}>
      <div style={{ height: 1, flex: 1, background: dark ? 'rgba(255,255,255,.3)' : colors.line }} />
      <span style={{ fontSize: 12, fontWeight: 800 }}>Lagos · {title}</span>
    </div>
  </AbsoluteFill>
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ border: `1px solid ${colors.line}`, borderRadius: 24, background: '#fff', boxShadow: '0 22px 55px rgba(16,35,62,.12)', ...style }}>{children}</div>
}

function Label({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'red' | 'green' | 'gold' }) {
  const background = tone === 'red' ? '#fff0f1' : tone === 'green' ? '#eaf9f1' : tone === 'gold' ? '#fff7e7' : colors.mist
  const color = tone === 'red' ? '#b42332' : tone === 'green' ? '#187c4e' : tone === 'gold' ? '#976310' : colors.deepWater
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, background, color, fontSize: 12, fontWeight: 850 }}>{children}</span>
}

function Dot({ color }: { color: string }) { return <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: color, boxShadow: `0 0 0 4px ${color}22` }} /> }

const mapBounds = { minLongitude: 3.325, maxLongitude: 3.415, minLatitude: 6.48, maxLatitude: 6.635 }
function project(point: Coordinate, width = 1180, height = 630): [number, number] {
  const x = 70 + ((point.longitude - mapBounds.minLongitude) / (mapBounds.maxLongitude - mapBounds.minLongitude)) * (width - 140)
  const y = 50 + ((mapBounds.maxLatitude - point.latitude) / (mapBounds.maxLatitude - mapBounds.minLatitude)) * (height - 100)
  return [x, y]
}
function points(points: readonly Coordinate[]): string { return points.map((point) => project(point).join(',')).join(' ') }

function MapCanvas({ mode = 'overview', vehicleProgress = 0, showIncidentMarkers = true }: { mode?: 'overview' | 'warning' | 'planning' | 'comparison' | 'navigation' | 'trigger' | 'reroute'; vehicleProgress?: number; showIncidentMarkers?: boolean }) {
  const width = 1180
  const height = 630
  const [originX, originY] = project(scenario.origin)
  const [destinationX, destinationY] = project(scenario.destination)
  const [warningX, warningY] = project(scenario.incidents[3].coordinates)
  const polygon = scenario.officialWarning.geometry.map((point) => project(point).join(',')).join(' ')
  const route = mode === 'reroute' ? scenario.routes.alternative : scenario.routes.fast
  const path = points(route)
  const routeAlternative = points(scenario.routes.alternative)
  const routeIndex = Math.min(route.length - 1, Math.floor(vehicleProgress * (route.length - 1)))
  const [vehicleX, vehicleY] = project(route[routeIndex])
  return <Card style={{ position: 'relative', overflow: 'hidden', background: '#dbeaf1', border: 0, boxShadow: '0 20px 50px rgba(16,35,62,.18)' }}>
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', background: '#dbeaf1' }}>
      <defs>
        <pattern id="map-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#c4d9e1" strokeWidth="1" opacity=".55" /></pattern>
        <filter id="pin-shadow"><feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#10233e" floodOpacity=".25" /></filter>
      </defs>
      <rect width={width} height={height} fill="#deedf1" />
      <rect width={width} height={height} fill="url(#map-grid)" />
      <path d="M-30 570 C180 490 280 570 420 430 S700 420 780 260 S1010 150 1210 45" fill="none" stroke="#b9d2dc" strokeWidth="44" opacity=".7" />
      <path d="M-30 570 C180 490 280 570 420 430 S700 420 780 260 S1010 150 1210 45" fill="none" stroke="#f5fbfc" strokeWidth="31" opacity=".9" />
      <path d="M70 120 C250 220 340 160 510 240 S800 350 1120 250" fill="none" stroke="#c4d8de" strokeWidth="19" opacity=".8" />
      <path d="M80 470 C260 360 390 400 560 470 S850 540 1120 450" fill="none" stroke="#c4d8de" strokeWidth="17" opacity=".8" />
      <path d="M510 35 C500 190 540 300 500 430 S530 560 560 650" fill="none" stroke="#c4d8de" strokeWidth="14" opacity=".72" />
      <path d="M890 20 C800 150 850 250 910 340 S930 520 890 640" fill="none" stroke="#c4d8de" strokeWidth="14" opacity=".72" />
      {(mode === 'warning' || mode === 'overview' || mode === 'planning' || mode === 'comparison' || mode === 'navigation' || mode === 'trigger' || mode === 'reroute') && <polygon points={polygon} fill={mode === 'warning' ? '#ef444422' : '#159bd711'} stroke={mode === 'warning' ? '#dc3545' : '#159bd7'} strokeWidth="3" strokeDasharray="10 8" />}
      {(mode === 'comparison' || mode === 'navigation' || mode === 'trigger') && <polyline points={routeAlternative} fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />}
      {(mode === 'comparison' || mode === 'navigation' || mode === 'trigger' || mode === 'reroute') && <polyline points={path} fill="none" stroke="#fff" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" opacity=".95" />}
      {(mode === 'comparison' || mode === 'navigation' || mode === 'trigger' || mode === 'reroute') && <polyline points={path} fill="none" stroke={mode === 'reroute' ? colors.green : colors.water} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />}
      {showIncidentMarkers && scenario.incidents.slice(0, mode === 'overview' ? 3 : 4).map((incident) => {
        const [x, y] = project(incident.coordinates)
        const isSevere = incident.severity === 'SEVERE'
        return <g key={incident.id} transform={`translate(${x} ${y})`} filter="url(#pin-shadow)">
          <circle r={isSevere ? 20 : 16} fill={isSevere ? '#dc3545' : incident.severity === 'HIGH' ? '#ee8a2f' : '#f4aa43'} stroke="#fff" strokeWidth="5" />
          <path d="M0 28 L-8 14 L8 14 Z" fill={isSevere ? '#dc3545' : incident.severity === 'HIGH' ? '#ee8a2f' : '#f4aa43'} stroke="#fff" strokeWidth="3" />
          <text x="28" y="5" fill="#10233e" fontSize="17" fontWeight="800">{incident.label}</text>
        </g>
      })}
      {(mode === 'warning' || mode === 'trigger') && <g transform={`translate(${warningX} ${warningY})`} filter="url(#pin-shadow)"><circle r="25" fill={colors.red} stroke="#fff" strokeWidth="6" /><text x="-9" y="10" fill="#fff" fontSize="28" fontWeight="900">!</text><text x="35" y="7" fill={colors.ink} fontSize="18" fontWeight="900">Official warning area</text></g>}
      {(mode === 'comparison' || mode === 'navigation' || mode === 'trigger' || mode === 'reroute') && <g transform={`translate(${originX} ${originY})`}><circle r="14" fill="#fff" stroke={colors.water} strokeWidth="5" /><circle r="5" fill={colors.water} /><text x="20" y="6" fill={colors.ink} fontSize="17" fontWeight="900">Ikeja</text></g>}
      {(mode === 'comparison' || mode === 'navigation' || mode === 'trigger' || mode === 'reroute') && <g transform={`translate(${destinationX} ${destinationY})`}><path d="M0 -28 C-20 -28 -25 -5 0 21 C25 -5 20 -28 0 -28Z" fill={colors.red} stroke="#fff" strokeWidth="5" /><circle cy="-7" r="6" fill="#fff" /><text x="30" y="4" fill={colors.ink} fontSize="17" fontWeight="900">Yaba · destination</text></g>}
      {(mode === 'navigation' || mode === 'trigger') && <g transform={`translate(${vehicleX} ${vehicleY})`}><circle r="22" fill={colors.water} stroke="#fff" strokeWidth="6" /><path d="M-8 8 L0 -12 L8 8 L0 4Z" fill="#fff" /><text x="32" y="6" fill={colors.deepWater} fontSize="17" fontWeight="900">You are here</text></g>}
    </svg>
    <div style={{ position: 'absolute', top: 22, left: 24, padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,.9)', color: colors.ink, fontSize: 12, fontWeight: 850, boxShadow: '0 7px 18px rgba(16,35,62,.12)' }}>Map · Lagos, Nigeria</div>
    {mode === 'warning' && <div style={{ position: 'absolute', right: 22, bottom: 22, padding: '12px 16px', border: '1px solid #f3b4ba', borderRadius: 14, background: 'rgba(255,246,247,.95)', color: '#a62432', fontSize: 13, fontWeight: 850 }}>Warning area focused</div>}
  </Card>
}

function LandingScene({ frame }: { frame: number }) {
  const lift = spring({ frame, fps: 30, config: { damping: 18, stiffness: 90 } })
  return <SceneFrame frame={frame} duration={sceneFrames.landing} kicker="The problem" title="Flood mobility intelligence"><div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 80, alignItems: 'center' }}>
    <div style={{ transform: `translateY(${interpolate(lift, [0, 1], [28, 0])}px)` }}><Label>Hyperlocal flood mobility</Label><h1 style={{ maxWidth: 760, margin: '22px 0 18px', fontSize: 74, lineHeight: 1.02, letterSpacing: '-.065em' }}>See the flood risk before you move.</h1><p style={{ maxWidth: 640, margin: 0, color: colors.body, fontSize: 24, lineHeight: 1.45 }}>FloodLine combines community reports, official warnings, and route conditions into a practical travel decision.</p><div style={{ display: 'flex', gap: 12, marginTop: 34 }}><div style={{ padding: '15px 22px', borderRadius: 14, background: colors.water, color: '#fff', fontWeight: 850 }}>View live map <span style={{ marginLeft: 22 }}>→</span></div><div style={{ padding: '15px 22px', borderRadius: 14, background: colors.mist, color: colors.deepWater, fontWeight: 850 }}>Plan a safe route</div></div></div>
    <Card style={{ padding: 24, background: '#f8fcfe' }}><div style={{ display: 'grid', gap: 12 }}><Stat value="3" label="active demo incidents" tone={colors.red} /><Stat value="1" label="official warning area" tone={colors.gold} /><Stat value="2" label="route alternatives" tone={colors.water} /><div style={{ marginTop: 8, padding: 18, borderRadius: 17, background: '#fff', border: `1px solid ${colors.line}` }}><span style={{ color: colors.muted, fontSize: 12, fontWeight: 800 }}>DEMO SCENARIO</span><strong style={{ display: 'block', marginTop: 6, color: colors.ink, fontSize: 19 }}>Ikeja → Yaba</strong><span style={{ display: 'block', marginTop: 4, color: colors.body, fontSize: 13 }}>Seeded records · PostGIS route-risk evaluation</span></div></div></Card>
  </div></SceneFrame>
}

function Stat({ value, label, tone }: { value: string; label: string; tone: string }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 17px', borderRadius: 16, background: '#fff', border: `1px solid ${colors.line}` }}><strong style={{ color: tone, fontSize: 32, letterSpacing: '-.04em' }}>{value}</strong><span style={{ color: colors.body, fontSize: 14, fontWeight: 750 }}>{label}</span></div> }

function OverviewScene({ frame }: { frame: number }) {
  return <SceneFrame frame={frame} duration={sceneFrames.overview} kicker="Step 1 · shared picture" title="Active reports and warnings"><div style={{ display: 'grid', gridTemplateColumns: '1.5fr .65fr', gap: 28, alignItems: 'stretch' }}><MapCanvas mode="overview" /><Card style={{ padding: 25, display: 'flex', flexDirection: 'column', gap: 16 }}><Label tone="red"><Dot color={colors.red} />Live map view</Label><h2 style={{ margin: 0, fontSize: 30, letterSpacing: '-.04em' }}>Know what is happening nearby.</h2><p style={{ margin: 0, color: colors.body, fontSize: 16, lineHeight: 1.5 }}>The seeded Lagos scenario combines community-generated incidents with an official warning area.</p><div style={{ display: 'grid', gap: 10, marginTop: 'auto' }}>{scenario.incidents.slice(0, 3).map((incident) => <IncidentRow key={incident.id} incident={incident} />)}</div></Card></div></SceneFrame>
}

function IncidentRow({ incident }: { incident: ScenarioIncident }) { const color = incident.severity === 'SEVERE' ? colors.red : incident.severity === 'HIGH' ? colors.orange : '#f4aa43'; return <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: `1px solid ${colors.line}` }}><Dot color={color} /><span style={{ flex: 1, color: colors.ink, fontSize: 13, fontWeight: 800 }}>{incident.label}</span><span style={{ color: colors.muted, fontSize: 11, fontWeight: 800 }}>{incident.confidence}</span></div> }

function WarningScene({ frame }: { frame: number }) { return <SceneFrame frame={frame} duration={sceneFrames.warning} kicker="Step 2 · official warning" title="Warning area"><div style={{ display: 'grid', gridTemplateColumns: '1.5fr .65fr', gap: 28, alignItems: 'stretch' }}><MapCanvas mode="warning" showIncidentMarkers={false} /><Card style={{ padding: 28 }}><Label tone="red"><Dot color={colors.red} />Official warning</Label><h2 style={{ margin: '22px 0 12px', fontSize: 32, lineHeight: 1.1, letterSpacing: '-.04em' }}>Controlled advisory: flooding near inland Lagos routes</h2><p style={{ color: colors.body, fontSize: 16, lineHeight: 1.5 }}>The map focuses on the affected geometry and places an explicit warning marker at the area of concern.</p><div style={{ marginTop: 26, padding: 16, borderRadius: 15, background: '#fff7f7', border: '1px solid #f3c1c5' }}><span style={{ color: colors.muted, fontSize: 11, fontWeight: 850, letterSpacing: '.1em' }}>SOURCE</span><strong style={{ display: 'block', marginTop: 6, color: colors.ink }}>FloodLine Demo Authority</strong><span style={{ display: 'block', marginTop: 4, color: colors.body, fontSize: 13 }}>Published for the controlled hackathon scenario</span></div></Card></div></SceneFrame> }

function PlanningScene({ frame }: { frame: number }) { return <SceneFrame frame={frame} duration={sceneFrames.planning} kicker="Step 3 · route planning" title="Plan a safer journey"><div style={{ display: 'grid', gridTemplateColumns: '.7fr 1.3fr', gap: 28, alignItems: 'stretch' }}><Card style={{ padding: 28 }}><Label>Flood-aware routing</Label><h2 style={{ margin: '22px 0 24px', fontSize: 34, letterSpacing: '-.045em' }}>Where are you going?</h2><LocationField label="Starting point" value="Ikeja" active /><div style={{ height: 30, borderLeft: `2px dashed ${colors.water}`, marginLeft: 19 }} /><LocationField label="Destination" value="Yaba, Lagos" /><div style={{ marginTop: 26, padding: '16px 20px', borderRadius: 14, background: colors.water, color: '#fff', fontSize: 16, fontWeight: 850, textAlign: 'center' }}>Show routes</div><p style={{ margin: '18px 0 0', color: colors.muted, fontSize: 12, lineHeight: 1.5 }}>Controlled Lagos demo trip · no judge GPS required</p></Card><MapCanvas mode="planning" /></div></SceneFrame> }
function LocationField({ label, value, active = false }: { label: string; value: string; active?: boolean }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '16px 15px', border: `1px solid ${colors.line}`, borderRadius: 15, background: '#fbfdfe' }}><Dot color={active ? colors.water : colors.red} /><div><span style={{ display: 'block', color: colors.muted, fontSize: 11, fontWeight: 800 }}>{label}</span><strong style={{ display: 'block', marginTop: 4, color: colors.ink, fontSize: 17 }}>{value}</strong></div></div> }

function ComparisonScene({ frame }: { frame: number }) { return <SceneFrame frame={frame} duration={sceneFrames.comparison} kicker="Step 4 · compare routes" title="Route alternatives"><div style={{ display: 'grid', gridTemplateColumns: '1.35fr .8fr', gap: 28, alignItems: 'stretch' }}><MapCanvas mode="comparison" showIncidentMarkers={false} /><div style={{ display: 'grid', gap: 16 }}><RouteCard label="Route A" duration="26 min" distance="15.0 km" risk="Lower reported flood risk" report="No currently known reports" tone="green" recommended /><RouteCard label="Route B" duration="26 min" distance="15.1 km" risk="Flood reports detected" report="1 severe hazard on route · 14 confirmations" tone="red" /></div></div></SceneFrame> }
function RouteCard({ label, duration, distance, risk, report, tone, recommended = false }: { label: string; duration: string; distance: string; risk: string; report: string; tone: 'red' | 'green'; recommended?: boolean }) { return <Card style={{ padding: 22, border: recommended ? `2px solid ${colors.water}` : `1px solid ${colors.line}`, position: 'relative' }}>{recommended && <span style={{ position: 'absolute', top: 0, right: 0, padding: '7px 13px', borderRadius: '0 20px 0 14px', background: colors.water, color: '#fff', fontSize: 11, fontWeight: 850 }}>RECOMMENDED</span>}<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ margin: 0, fontSize: 22 }}>{label}</h3><Label tone={tone}><Dot color={tone === 'red' ? colors.red : colors.green} />{tone === 'red' ? 'Reported hazard' : 'Lower risk'}</Label></div><strong style={{ display: 'block', marginTop: 16, color: colors.ink, fontSize: 25 }}>{duration} <span style={{ color: colors.muted, fontSize: 14, fontWeight: 600 }}>· {distance}</span></strong><p style={{ margin: '9px 0 0', color: tone === 'red' ? '#b42332' : '#187c4e', fontSize: 14, fontWeight: 800 }}>{risk}</p><span style={{ display: 'block', marginTop: 7, color: colors.body, fontSize: 13 }}>{report}</span><div style={{ marginTop: 17, padding: '12px 14px', borderRadius: 12, background: tone === 'red' ? '#fff6f6' : '#f1fbf5', color: colors.body, fontSize: 12, lineHeight: 1.4 }}>Evidence confidence is calculated server-side from active incident data.</div></Card> }

function NavigationScene({ frame }: { frame: number }) { const progress = interpolate(frame, [0, sceneFrames.navigation], [.16, .57], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); return <SceneFrame frame={frame} duration={sceneFrames.navigation} kicker="Step 5 · active navigation" title="Monitor the journey"><div style={{ position: 'relative' }}><MapCanvas mode="navigation" vehicleProgress={progress} showIncidentMarkers={false} /><Card style={{ position: 'absolute', right: 22, bottom: 22, width: 380, padding: 22 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><span style={{ color: colors.muted, fontSize: 11, fontWeight: 850, letterSpacing: '.1em' }}>ROUTE ACTIVE</span><h3 style={{ margin: '7px 0 0', fontSize: 24 }}>Ikeja → Yaba</h3></div><Label tone="green"><Dot color={colors.green} />Monitoring live</Label></div><div style={{ height: 8, marginTop: 19, borderRadius: 99, background: '#e8f0f4', overflow: 'hidden' }}><div style={{ width: `${progress * 100}%`, height: '100%', borderRadius: 99, background: colors.water }} /></div><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9, color: colors.muted, fontSize: 12 }}><span>Demo GPS simulation</span><span>22 min remaining</span></div></Card></div></SceneFrame> }

function TriggerScene({ frame }: { frame: number }) { const pulse = 1 + Math.sin(frame / 8) * .07; return <SceneFrame frame={frame} duration={sceneFrames.trigger} kicker="Step 6 · conditions change" title="New evidence affects the route"><div style={{ display: 'grid', gridTemplateColumns: '1.25fr .75fr', gap: 28, alignItems: 'stretch' }}><div style={{ position: 'relative' }}><MapCanvas mode="trigger" vehicleProgress={.69} showIncidentMarkers={false} /><div style={{ position: 'absolute', top: 22, right: 22, display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', borderRadius: 14, background: '#fff2f3', border: '1px solid #efb1b7', color: '#a62432', fontSize: 14, fontWeight: 850, transform: `scale(${pulse})` }}><Dot color={colors.red} />Flood hazard activated</div></div><Card style={{ padding: 28 }}><Label tone="red"><Dot color={colors.red} />Demo control</Label><h2 style={{ margin: '22px 0 13px', fontSize: 34, lineHeight: 1.1, letterSpacing: '-.045em' }}>A new flood hazard affects Route B.</h2><p style={{ color: colors.body, fontSize: 16, lineHeight: 1.5 }}>The seeded incident is activated through the product control. BullMQ sends the route-evaluation job to the worker and checks Route A as the alternative.</p><div style={{ display: 'grid', gap: 10, marginTop: 25 }}><StatusRow text="Hazard activated" done /><StatusRow text="Checking lower-risk routes" done={frame > 100} /><StatusRow text="Evaluating corridor impact" done={frame > 175} /></div><div style={{ marginTop: 24, padding: '15px 17px', borderRadius: 14, background: colors.ink, color: '#fff', textAlign: 'center', fontWeight: 850 }}>Trigger flood hazard</div></Card></div></SceneFrame> }
function StatusRow({ text, done }: { text: string; done: boolean }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 11, color: done ? colors.ink : colors.muted, fontSize: 14, fontWeight: 800 }}><span style={{ display: 'grid', width: 23, height: 23, placeItems: 'center', borderRadius: '50%', background: done ? '#eaf9f1' : '#f2f6f8', color: done ? colors.green : colors.muted }}>{done ? '✓' : '·'}</span>{text}</div> }

function RerouteScene({ frame }: { frame: number }) { return <SceneFrame frame={frame} duration={sceneFrames.reroute} kicker="Step 7 · response" title="Route updated" dark><div style={{ display: 'grid', gridTemplateColumns: '1.45fr .7fr', gap: 28, alignItems: 'stretch' }}><MapCanvas mode="reroute" vehicleProgress={.74} showIncidentMarkers={false} /><div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 30, borderRadius: 24, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)' }}><Label tone="green"><Dot color={colors.green} />Lower-risk route active</Label><h2 style={{ margin: '24px 0 14px', fontSize: 42, lineHeight: 1.05, letterSpacing: '-.05em' }}>The journey changes with the evidence.</h2><p style={{ margin: 0, color: '#d1deeb', fontSize: 17, lineHeight: 1.5 }}>FloodLine found a route alternative that meets the configured travel-time policy while avoiding the reported hazard corridor.</p><div style={{ display: 'flex', gap: 10, marginTop: 26, flexWrap: 'wrap' }}><Label tone="green">Route updated</Label><Label tone="blue">Avoiding reported flooding</Label></div></div></div></SceneFrame> }

function AlertsScene({ frame }: { frame: number }) { const pulse = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' }); return <SceneFrame frame={frame} duration={sceneFrames.alerts} kicker="Step 8 · alert history" title="Actionable updates"><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'center' }}><Card style={{ padding: 29, transform: `translateY(${interpolate(pulse, [0, 1], [18, 0])}px)` }}><Label tone="red"><Dot color={colors.red} />New FloodLine alert</Label><h2 style={{ margin: '22px 0 10px', fontSize: 34, letterSpacing: '-.045em' }}>Route updated</h2><p style={{ margin: 0, color: colors.body, fontSize: 17, lineHeight: 1.5 }}>Avoiding reported flooding near the fast Ikeja–Yaba route. A lower reported flood-risk alternative is active.</p><div style={{ display: 'flex', gap: 9, marginTop: 22 }}><Label tone="blue">In-app history</Label><Label tone="green">Unread</Label></div></Card><div><span style={{ color: '#b8cadb', fontSize: 13, fontWeight: 850, letterSpacing: '.12em' }}>WHAT FLOODLINE ADDS</span><h2 style={{ margin: '17px 0', fontSize: 47, lineHeight: 1.04, letterSpacing: '-.06em' }}>Better information before the next turn.</h2><p style={{ margin: 0, color: '#d1deeb', fontSize: 18, lineHeight: 1.5 }}>Not a promise of a safe road. A clearer decision from the flood evidence available now.</p><div style={{ marginTop: 26, color: '#fff', fontSize: 17, fontWeight: 850 }}>FloodLine · Lagos · controlled seeded scenario</div></div></div></SceneFrame> }

export function FloodLineDemo() {
  return <AbsoluteFill style={{ background: colors.ink, overflow: 'hidden' }}>
    <Sequence from={0} durationInFrames={sceneFrames.landing}><LandingScene frame={useCurrentFrame()} /></Sequence>
    <Sequence from={sceneFrames.landing} durationInFrames={sceneFrames.overview}><OverviewScene frame={useCurrentFrame() - sceneFrames.landing} /></Sequence>
    <Sequence from={sceneFrames.landing + sceneFrames.overview} durationInFrames={sceneFrames.warning}><WarningScene frame={useCurrentFrame() - sceneFrames.landing - sceneFrames.overview} /></Sequence>
    <Sequence from={sceneFrames.landing + sceneFrames.overview + sceneFrames.warning} durationInFrames={sceneFrames.planning}><PlanningScene frame={useCurrentFrame() - sceneFrames.landing - sceneFrames.overview - sceneFrames.warning} /></Sequence>
    <Sequence from={sceneFrames.landing + sceneFrames.overview + sceneFrames.warning + sceneFrames.planning} durationInFrames={sceneFrames.comparison}><ComparisonScene frame={useCurrentFrame() - sceneFrames.landing - sceneFrames.overview - sceneFrames.warning - sceneFrames.planning} /></Sequence>
    <Sequence from={sceneFrames.landing + sceneFrames.overview + sceneFrames.warning + sceneFrames.planning + sceneFrames.comparison} durationInFrames={sceneFrames.navigation}><NavigationScene frame={useCurrentFrame() - sceneFrames.landing - sceneFrames.overview - sceneFrames.warning - sceneFrames.planning - sceneFrames.comparison} /></Sequence>
    <Sequence from={sceneFrames.landing + sceneFrames.overview + sceneFrames.warning + sceneFrames.planning + sceneFrames.comparison + sceneFrames.navigation} durationInFrames={sceneFrames.trigger}><TriggerScene frame={useCurrentFrame() - sceneFrames.landing - sceneFrames.overview - sceneFrames.warning - sceneFrames.planning - sceneFrames.comparison - sceneFrames.navigation} /></Sequence>
    <Sequence from={sceneFrames.landing + sceneFrames.overview + sceneFrames.warning + sceneFrames.planning + sceneFrames.comparison + sceneFrames.navigation + sceneFrames.trigger} durationInFrames={sceneFrames.reroute}><RerouteScene frame={useCurrentFrame() - sceneFrames.landing - sceneFrames.overview - sceneFrames.warning - sceneFrames.planning - sceneFrames.comparison - sceneFrames.navigation - sceneFrames.trigger} /></Sequence>
    <Sequence from={sceneFrames.landing + sceneFrames.overview + sceneFrames.warning + sceneFrames.planning + sceneFrames.comparison + sceneFrames.navigation + sceneFrames.trigger + sceneFrames.reroute} durationInFrames={sceneFrames.alerts}><AlertsScene frame={useCurrentFrame() - sceneFrames.landing - sceneFrames.overview - sceneFrames.warning - sceneFrames.planning - sceneFrames.comparison - sceneFrames.navigation - sceneFrames.trigger - sceneFrames.reroute} /></Sequence>
  </AbsoluteFill>
}
