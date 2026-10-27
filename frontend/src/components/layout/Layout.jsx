import SiteFooter from './SiteFooter'
import SiteHeader from './SiteHeader'
import UtilityBar from './UtilityBar'

// Shared chrome for every page: tricolour stripe, utility bar, header, main landmark, footer.
export default function Layout({ nav = [], controls = null, quickLinks = [], children, bare = false }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-ink">
      <div aria-hidden="true" className="flex h-1 shrink-0">
        <div className="flex-1 bg-saffron" />
        <div className="flex-1 border-y border-border bg-white" />
        <div className="flex-1 bg-india-green" />
      </div>
      <UtilityBar />
      <SiteHeader nav={nav} controls={controls} />
      <main id="main-content" tabIndex={-1} className={`outline-none ${bare ? '' : 'mx-auto w-full max-w-6xl px-4 py-8 sm:px-6'}`}>{children}</main>
      <SiteFooter links={quickLinks} />
    </div>
  )
}
