import { Icon } from '../ui/Icon'
import { ScreenButton } from '../ui/ScreenButton'

export function SearchBar({ onClick }: { onClick?: () => void }) {
  return (
    <ScreenButton className="search-bar" onClick={onClick}>
      <Icon name="search.svg" />
      <span>Search road, area, or destination</span>
    </ScreenButton>
  )
}

export function WarningBanner() {
  return (
    <ScreenButton className="warning-banner">
      <span className="warning-icon"><Icon name="warning.svg" /></span>
      <span className="warning-copy">
        <strong>Official flood warning affects Home</strong>
        <small>LASEMA Advisory • Published 8:10 AM</small>
      </span>
      <span className="warning-view">View</span>
      <span className="warning-rule" />
    </ScreenButton>
  )
}
