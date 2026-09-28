import { Icon } from '../ui/Icon'
import { ScreenButton } from '../ui/ScreenButton'
import type { AssetName } from '../../types'

export type ReportStep = 'type' | 'severity' | 'location' | 'evidence' | 'confirm' | 'success'
export type ReportKind = { id: string; label: string; icon: AssetName }

export function ReportHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <header className="report-header"><ScreenButton className="report-back-button" onClick={onBack} ariaLabel="Go back"><Icon name="report-back.svg" /></ScreenButton><h1>{title}</h1></header>
}

export function ReportFooter({ label = 'Continue', onClick, disabled = false, secondaryLabel, onSecondaryClick }: { label?: string; onClick?: () => void; disabled?: boolean; secondaryLabel?: string; onSecondaryClick?: () => void }) {
  return <footer className="report-footer"><ScreenButton className="report-primary-button" onClick={onClick} disabled={disabled}>{label}</ScreenButton>{secondaryLabel && <ScreenButton className="report-secondary-button" onClick={onSecondaryClick}>{secondaryLabel}</ScreenButton>}</footer>
}

export function ReportTypeCard({ kind, selected, onSelect }: { kind: ReportKind; selected: boolean; onSelect: () => void }) {
  return <ScreenButton className={`report-type-card ${selected ? 'is-selected' : ''}`} onClick={onSelect}><span className="report-type-icon"><Icon name={kind.icon} /></span><strong>{kind.label}</strong>{selected && <span className="report-selection"><Icon name="report-selected-primary.svg" /></span>}</ScreenButton>
}

export function SeverityCard({ label, description, tone, selected, onSelect }: { label: string; description: string; tone: string; selected: boolean; onSelect: () => void }) {
  return <ScreenButton className={`report-severity-card severity-${tone} ${selected ? 'is-selected' : ''}`} onClick={onSelect}><span className="severity-copy"><strong>{label}</strong><small>{description}</small></span>{selected ? <span className="report-selection"><Icon name="report-selected-primary.svg" /></span> : <span className="severity-dot" />}</ScreenButton>
}

export function ReportStepIntro({ title, copy }: { title: string; copy: string }) {
  return <div className="report-step-intro"><h2>{title}</h2><p>{copy}</p></div>
}
