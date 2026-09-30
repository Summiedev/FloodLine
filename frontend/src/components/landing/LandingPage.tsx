import { Icon } from '../ui/Icon'
import { ScreenButton } from '../ui/ScreenButton'
import type { Navigate } from '../../types'

const promises = [
  { number: '01', title: 'See risk early', copy: 'Official warnings and community reports stay visible where you need them.' },
  { number: '02', title: 'Choose safer routes', copy: 'Compare route options with clear flood-risk context before you move.' },
  { number: '03', title: 'Stay informed', copy: 'Live monitoring keeps you updated when conditions change ahead.' },
]

const metrics = [
  { value: '24/7', label: 'hazard monitoring' },
  { value: '3 signals', label: 'official, community, route' },
  { value: '1 view', label: 'for every safer decision' },
]

export function LandingPage({ navigate }: { navigate: Navigate }) {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <div className="landing-brand"><span className="brand-mark"><Icon name="route.svg" /></span><strong>FloodLine</strong></div>
        <div className="landing-nav-actions"><ScreenButton className="landing-sign-in" onClick={() => navigate('login')}>Sign in</ScreenButton><ScreenButton className="landing-nav-action" onClick={() => navigate('home')}>Open live map</ScreenButton></div>
      </header>
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <h1>See the flood risk before you move.</h1>
          <p>FloodLine turns live flood reports, official warnings, and route conditions into clear decisions for safer journeys.</p>
          <div className="landing-actions">
            <ScreenButton className="landing-primary-action" onClick={() => navigate('home')}>View live map <span>→</span></ScreenButton>
            <ScreenButton className="landing-secondary-action" onClick={() => navigate('route-search', { sheet: true })}>Plan a safe route</ScreenButton>
          </div>
        </div>
        <div className="landing-hero-visual" aria-label="FloodLine live map preview">
          <div className="landing-map-preview" />
          <div className="landing-map-overlay" />
          <div className="landing-preview-card landing-preview-search"><Icon name="search.svg" /><span>Search road, area, or destination</span></div>
          <div className="landing-preview-alert"><span className="preview-alert-icon"><Icon name="warning.svg" /></span><div><strong>Official flood warning</strong><small>LASEMA Advisory • Published 8:10 AM</small></div><ScreenButton className="landing-preview-view" onClick={() => navigate('home')}>View</ScreenButton></div>
          <div className="landing-preview-route"><Icon name="route.svg" /><span><small>Safer route found</small><strong>31 min <em>• Lower reported risk</em></strong></span></div>
          <span className="landing-preview-marker"><Icon name="severe.svg" /></span>
        </div>
      </section>
      <section className="landing-metrics" aria-label="FloodLine at a glance">
        {metrics.map((metric) => <div className="landing-metric" key={metric.value}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}
      </section>
      <section className="landing-promises" aria-label="FloodLine benefits">
        {promises.map((promise) => <article className="landing-promise" key={promise.number}><span className="promise-number">{promise.number}</span><div><h2>{promise.title}</h2><p>{promise.copy}</p></div></article>)}
      </section>
      <footer className="landing-footer"><span>FloodLine</span><span>Move with more certainty.</span></footer>
    </main>
  )
}
