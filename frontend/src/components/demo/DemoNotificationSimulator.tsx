import { Bell, MessageCircle, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { ScreenButton } from '../ui/ScreenButton'

type DemoChannel = 'APP_PUSH' | 'SMS' | 'WHATSAPP'

const channels: Array<{ id: DemoChannel; label: string; icon: typeof Bell }> = [
  { id: 'APP_PUSH', label: 'App notification', icon: Smartphone },
  { id: 'SMS', label: 'SMS preview', icon: MessageCircle },
  { id: 'WHATSAPP', label: 'WhatsApp preview', icon: MessageCircle },
]

/** A deliberately local preview for recordings when external delivery is not configured. */
export function DemoNotificationSimulator() {
  const [channel, setChannel] = useState<DemoChannel>('APP_PUSH')
  const selected = channels.find((item) => item.id === channel) ?? channels[0]
  const Icon = selected.icon

  return <article className="demo-notification-simulator">
    <div className="demo-simulator-heading">
      <span className="demo-simulator-icon"><Bell size={18} /></span>
      <div>
        <span className="demo-simulator-kicker">Hackathon demo</span>
        <h2>Notification simulator</h2>
      </div>
    </div>
    <p>Preview how an alert will look. This does not send a real SMS, WhatsApp message, or push notification.</p>
    <div className="demo-simulator-actions" aria-label="Choose a notification preview">
      {channels.map((item) => {
        const ItemIcon = item.icon
        return <ScreenButton key={item.id} className={`demo-simulator-channel ${channel === item.id ? 'is-selected' : ''}`} onClick={() => setChannel(item.id)} ariaLabel={`Preview ${item.label}`}><ItemIcon size={15} /><span>{item.label}</span></ScreenButton>
      })}
    </div>
    <div className="demo-simulator-preview">
      <span className="demo-preview-app-icon"><Icon size={16} /></span>
      <span><strong>{selected.label}</strong><small>Severe flooding reported near Home</small><em>Water is affecting the faster route. A lower reported-flood-risk alternative is available.</em></span>
    </div>
    <small className="demo-simulator-disclaimer">SIMULATION ONLY · no external provider was called</small>
  </article>
}
