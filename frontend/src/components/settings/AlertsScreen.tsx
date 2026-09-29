import { Bell, CircleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { alertsApi } from '../../api/services'
import type { Alert } from '../../api/types'
import type { Navigate } from '../../types'
import { BottomNav } from '../navigation/BottomNav'
import { ScreenButton } from '../ui/ScreenButton'

function severityClass(severity: Alert['severity']): string { return severity === 'SEVERE' ? 'alert-severity-severe' : severity === 'MODERATE' || severity === 'HIGH' ? 'alert-severity-moderate' : 'alert-severity-info' }
function timeAgo(value: string): string { const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000)); if (minutes < 1) return 'Just now'; if (minutes < 60) return `${minutes} min ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours} hr ago`; return `${Math.floor(hours / 24)} days ago` }

export function AlertsScreen({ navigate }: { navigate: Navigate }) {
  const [alerts, setAlerts] = useState<Alert[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [selected, setSelected] = useState<Alert | null>(null)
  const load = () => { setLoading(true); setError(''); alertsApi.list().then((result) => setAlerts(result.data)).catch(() => setError('Couldn’t load your alerts.')).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [])
  const unread = alerts.some((alert) => !alert.readAt)
  const open = (alert: Alert) => { setSelected(alert); if (!alert.readAt) alertsApi.read(alert.id).then(load).catch(() => undefined) }
  return <main className="settings-screen alerts-history-screen"><header className="alerts-history-header"><div><span className="settings-kicker">FloodLine updates</span><h1>Alerts</h1><p>Recent flood warnings and updates for places you watch.</p></div>{unread && <ScreenButton className="mark-all-read" onClick={() => alertsApi.readAll().then(load)}>Mark all read</ScreenButton>}</header><section className="alerts-history-content">{loading ? <div className="alert-skeleton-list"><span /><span /><span /></div> : error ? <div className="settings-state"><p>{error}</p><ScreenButton onClick={load}>Retry</ScreenButton></div> : alerts.length === 0 ? <div className="alerts-empty"><Bell size={34} /><h2>No alerts yet</h2><p>We’ll let you know when flooding affects the places you watch.</p></div> : <div className="alert-history-list">{alerts.map((alert) => <button className={`alert-history-card ${alert.readAt ? '' : 'is-unread'}`} key={alert.id} type="button" onClick={() => open(alert)}><span className={`alert-severity-dot ${severityClass(alert.severity)}`} /><span className="alert-history-copy"><strong>{alert.title}</strong><small>{alert.body}</small><time>{timeAgo(alert.createdAt)}</time></span>{!alert.readAt && <span className="alert-unread-dot" aria-label="Unread" />}</button>)}</div>}</section><BottomNav navigate={navigate} />{selected && <div className="alert-detail-backdrop" role="presentation"><section className="alert-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="alert-detail-title"><ScreenButton className="alert-detail-close" onClick={() => setSelected(null)} ariaLabel="Close alert">×</ScreenButton><span className={`alert-detail-icon ${severityClass(selected.severity)}`}><CircleAlert size={24} /></span><h2 id="alert-detail-title">{selected.title}</h2><p>{selected.body}</p><time>{new Date(selected.createdAt).toLocaleString()}</time><ScreenButton className="settings-primary" onClick={() => setSelected(null)}>Done</ScreenButton></section></div>}</main>
}
