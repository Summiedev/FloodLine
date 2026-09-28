import { useRef, useState } from 'react'
import { asset } from '../../lib/assets'
import { Icon } from '../ui/Icon'
import { ScreenButton } from '../ui/ScreenButton'
import type { Navigate } from '../../types'
import { ReportFooter, ReportHeader, ReportStepIntro, ReportTypeCard, SeverityCard, type ReportKind, type ReportStep } from './ReportPrimitives'

const reportKinds: ReportKind[] = [
  { id: 'flooded-road', label: 'Flooded Road', icon: 'report-flooded-road.svg' },
  { id: 'road-blocked', label: 'Road Blocked', icon: 'report-road-blocked.svg' },
  { id: 'blocked-drain', label: 'Blocked Drain', icon: 'report-blocked-drain.svg' },
  { id: 'building-flooding', label: 'Building Flooding', icon: 'report-building-flooding.svg' },
  { id: 'electrical-hazard', label: 'Electrical Hazard', icon: 'report-electrical.svg' },
  { id: 'road-clear', label: 'Road Clear', icon: 'report-road-clear.svg' },
]

const severityOptions = [
  { id: 'minor', label: 'Minor', tone: 'minor', description: 'Water below ankle level. Vehicles moving normally.' },
  { id: 'moderate', label: 'Moderate', tone: 'moderate', description: 'Water above ankle level. Vehicles are passing carefully.' },
  { id: 'severe', label: 'Severe', tone: 'severe', description: 'Water near tyre level. Small cars may not pass safely.' },
  { id: 'impassable', label: 'Impassable', tone: 'impassable', description: 'Road cannot be used safely. Vehicles are turning back or stranded.' },
]

function ReportTypeStep({ selected, onSelect, onContinue, onBack }: { selected: string | null; onSelect: (id: string) => void; onContinue: () => void; onBack: () => void }) {
  return <><ReportHeader title="Report Condition" onBack={onBack} /><section className="report-step-content"><ReportStepIntro title="What are you seeing?" copy="Help people nearby understand what's happening." /><div className="report-type-grid">{reportKinds.map((kind) => <ReportTypeCard key={kind.id} kind={kind} selected={selected === kind.id} onSelect={() => onSelect(kind.id)} />)}</div></section><ReportFooter onClick={onContinue} disabled={!selected} /></>
}

function SeverityStep({ selected, onSelect, onContinue, onBack }: { selected: string | null; onSelect: (id: string) => void; onContinue: () => void; onBack: () => void }) {
  return <><ReportHeader title="Severity" onBack={onBack} /><section className="report-step-content"><ReportStepIntro title="How bad is it?" copy="Choose the closest description so drivers can understand the risk." /><div className="report-severity-list">{severityOptions.map((option) => <SeverityCard key={option.id} {...option} selected={selected === option.id} onSelect={() => onSelect(option.id)} />)}</div></section><ReportFooter onClick={onContinue} disabled={!selected} /></>
}

function LocationStep({ location, landmark, onLocation, onLandmark, onContinue, onBack }: { location: string | null; landmark: string; onLocation: (value: string) => void; onLandmark: (value: string) => void; onContinue: () => void; onBack: () => void }) {
  return <><ReportHeader title="Location" onBack={onBack} /><section className="report-step-content"><ReportStepIntro title="Where is the flooding?" copy="Approximate location — move the pin if needed." /><div className="report-location-map"><div className="report-map-image" /><div className="report-map-wash" /><span className="report-map-pin"><Icon name="report-location-pin.svg" /></span></div><div className="location-suggestions"><ScreenButton className={`location-suggestion ${location === 'Admiralty Way' ? 'is-selected' : ''}`} onClick={() => onLocation('Admiralty Way')}>Admiralty Way</ScreenButton><ScreenButton className={`location-suggestion ${location === 'Lekki Phase 1' ? 'is-selected' : ''}`} onClick={() => onLocation('Lekki Phase 1')}>Lekki Phase 1</ScreenButton></div><input className="report-landmark-input" value={landmark} onChange={(event) => onLandmark(event.target.value)} placeholder="Add a landmark (e.g. opposite fuel station)" /></section><ReportFooter label="Confirm location" onClick={onContinue} disabled={!location} /></>
}

function EvidenceStep({ note, photoAdded, onNote, onPhoto, onContinue, onSkip, onBack }: { note: string; photoAdded: boolean; onNote: (value: string) => void; onPhoto: () => void; onContinue: () => void; onSkip: () => void; onBack: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  return <><ReportHeader title="Evidence" onBack={onBack} /><section className="report-step-content"><ReportStepIntro title="Show what's happening" copy="A photo helps others verify the report faster." />{photoAdded ? <div className="report-photo-preview"><img src={asset('report-photo.png')} alt="Flood condition evidence" /><ScreenButton className="report-photo-remove" onClick={onPhoto} ariaLabel="Remove photo"><Icon name="report-photo-remove.svg" /></ScreenButton></div> : <div className="report-photo-actions"><ScreenButton className="report-photo-button" onClick={onPhoto}><Icon name="report-camera.svg" /><strong>Take a photo</strong></ScreenButton><ScreenButton className="report-upload-button" onClick={() => fileInput.current?.click()}>or upload from gallery</ScreenButton><input ref={fileInput} className="visually-hidden" type="file" accept="image/*" onChange={onPhoto} /></div>}<label className="report-note-label">Anything drivers should know?<textarea value={note} onChange={(event) => onNote(event.target.value)} /></label></section><ReportFooter onClick={onContinue} secondaryLabel="Skip for now" onSecondaryClick={onSkip} /></>
}

function ConfirmStep({ kind, severity, location, note, photoAdded, onSubmit, onBack }: { kind: ReportKind | undefined; severity: string | null; location: string | null; note: string; photoAdded: boolean; onSubmit: () => void; onBack: () => void }) {
  return <><ReportHeader title="Confirm your report" onBack={onBack} /><section className="report-step-content report-confirm-content"><div className="report-confirm-icon"><Icon name="report-flooded-road.svg" /></div><h2>Flooding Reported</h2><p className="report-confirm-location">{location || 'Admiralty Way'}, Lekki Phase 1</p><div className="report-summary-card"><div><span>Condition</span><strong>{kind?.label || 'Flooded Road'}</strong></div><div><span>Severity</span><strong>{severity ? severityOptions.find((option) => option.id === severity)?.label : 'Severe'}</strong></div><div><span>Details</span><strong>{note || 'No additional details'}</strong></div><div><span>Evidence</span><strong>{photoAdded ? '1 photo' : '0 photos'}</strong></div></div><label className="report-now-toggle"><input type="checkbox" defaultChecked /><span className="toggle-ui" />Happening now</label><p className="report-privacy-copy">Your name and phone number won't be displayed publicly.</p></section><ReportFooter label="Report Flooding" onClick={onSubmit} /></>
}

function SuccessStep({ onMap }: { onMap: () => void }) {
  return <section className="report-success-screen"><div className="report-success-icon"><Icon name="report-success.svg" /></div><h1>Your report is live</h1><p>People nearby can now see this hazard.</p><ScreenButton className="report-primary-button" onClick={onMap}>Back to live map</ScreenButton></section>
}

export function ReportFlowScreen({ navigate }: { navigate: Navigate }) {
  const [step, setStep] = useState<ReportStep>('type')
  const [kindId, setKindId] = useState<string | null>(null)
  const [severity, setSeverity] = useState<string | null>(null)
  const [location, setLocation] = useState<string | null>(null)
  const [landmark, setLandmark] = useState('')
  const [note, setNote] = useState('dont drive pass the mid road, its sunken')
  const [photoAdded, setPhotoAdded] = useState(false)
  const kind = reportKinds.find((option) => option.id === kindId)
  const goBack = () => {
    if (step === 'type') navigate('home')
    else if (step === 'severity') setStep('type')
    else if (step === 'location') setStep('severity')
    else if (step === 'evidence') setStep('location')
    else if (step === 'confirm') setStep('evidence')
  }

  return <main className="screen-shell flow-shell report-shell" aria-label="Report a flood condition">{step === 'type' && <ReportTypeStep selected={kindId} onSelect={setKindId} onContinue={() => setStep('severity')} onBack={() => navigate('home')} />}{step === 'severity' && <SeverityStep selected={severity} onSelect={setSeverity} onContinue={() => setStep('location')} onBack={goBack} />}{step === 'location' && <LocationStep location={location} landmark={landmark} onLocation={setLocation} onLandmark={setLandmark} onContinue={() => setStep('evidence')} onBack={goBack} />}{step === 'evidence' && <EvidenceStep note={note} photoAdded={photoAdded} onNote={setNote} onPhoto={() => setPhotoAdded((value) => !value)} onContinue={() => setStep('confirm')} onSkip={() => setStep('confirm')} onBack={goBack} />}{step === 'confirm' && <ConfirmStep kind={kind} severity={severity} location={location} note={note} photoAdded={photoAdded} onSubmit={() => setStep('success')} onBack={goBack} />}{step === 'success' && <SuccessStep onMap={() => navigate('home')} />}</main>
}
