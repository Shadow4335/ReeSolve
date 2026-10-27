import { useLang, useT } from '../../i18n'

// Navy footer: about, helpline, quick links, last-updated date and the prototype disclaimer (no emblem, no official claims).
export default function SiteFooter({ links = [] }) {
  const t = useT()
  const { lang } = useLang()
  const updated = new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <footer className="mt-auto bg-navy-900 text-white">
      <div aria-hidden="true" className="h-0.5 bg-gradient-to-r from-saffron via-white to-india-green opacity-70" />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-3">
        <section>
          <h2 className="text-base font-semibold text-white">{t('footer.about')}</h2>
          <p className="mt-2 text-sm text-navy-50">{t('footer.aboutText')}</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-white">{t('footer.helpline')}</h2>
          <p className="mt-2 text-sm text-navy-50">{t('footer.helplineText')}</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-white">{t('footer.quick')}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {links.map((l) => (
              <li key={l.key}><button type="button" onClick={l.onClick} className="text-navy-50 underline underline-offset-2 hover:text-white">{l.label}</button></li>
            ))}
          </ul>
        </section>
      </div>
      <div className="border-t border-navy-700">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-x-6 gap-y-1 px-4 py-3 text-xs text-navy-50 sm:px-6">
          <span>{t('footer.updated')}: {updated}</span>
          <span>{t('footer.disclaimer')}</span>
        </div>
      </div>
    </footer>
  )
}
