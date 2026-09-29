import { Icon } from '../ui/Icon'
import { ScreenButton } from '../ui/ScreenButton'
import type { OfficialWarning } from '../../api/types'

export function SearchBar({ onClick }: { onClick?: () => void }) { return <ScreenButton className="search-bar" onClick={onClick}><Icon name="search.svg" /><span>Search road, area, or destination</span></ScreenButton> }
export function WarningBanner({ warning, onClick }: { warning?: OfficialWarning; onClick?: () => void }) { if (!warning) return null; return <ScreenButton className="warning-banner" onClick={onClick}><span className="warning-icon"><Icon name="warning.svg" /></span><span className="warning-copy"><strong>{warning.title}</strong><small>{warning.authority} · Published {new Date(warning.issuedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></span><span className="warning-view">View</span><span className="warning-rule" /></ScreenButton> }
