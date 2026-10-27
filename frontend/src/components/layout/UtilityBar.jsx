import { useLang, useT } from '../../i18n'
import { useTextSize } from '../../prefs'

const seg = (on) =>
  `rounded px-2 py-0.5 text-xs font-semibold ${on ? 'bg-navy-700 text-white' : 'border border-border bg-white text-navy-700 hover:bg-navy-50'}`

// Slim utility bar: skip link (first focusable element), text size A- A A+, language toggle.
export default function UtilityBar() {
  const t = useT()
  const { size, setSize } = useTextSize()
  const { lang, setLang } = useLang()
  const skip = (e) => {
    e.preventDefault()
    const main = document.getElementById('main-content')
    main?.focus()
    main?.scrollIntoView({ block: 'start' })
  }
  return (
    <div className="border-b border-border bg-navy-50 text-xs">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1 sm:px-6">
        <a href="#main-content" onClick={skip} className="sr-only rounded bg-navy-900 px-3 py-1 font-semibold text-white focus:not-sr-only">
          {t('util.skip')}
        </a>
        <div className="ml-auto flex items-center gap-4">
          <div role="group" aria-label={t('util.textSize')} className="flex items-center gap-1">
            <button type="button" aria-label={t('util.smaller')} aria-pressed={size === 'small'} onClick={() => setSize('small')} className={seg(size === 'small')}>A-</button>
            <button type="button" aria-label={t('util.normal')} aria-pressed={size === 'normal'} onClick={() => setSize('normal')} className={seg(size === 'normal')}>A</button>
            <button type="button" aria-label={t('util.larger')} aria-pressed={size === 'large'} onClick={() => setSize('large')} className={seg(size === 'large')}>A+</button>
          </div>
          <div role="group" aria-label={t('util.language')} className="flex items-center gap-1">
            <button type="button" lang="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')} className={seg(lang === 'en')}>English</button>
            <button type="button" lang="hi" aria-pressed={lang === 'hi'} onClick={() => setLang('hi')} className={seg(lang === 'hi')}>हिन्दी</button>
          </div>
        </div>
      </div>
    </div>
  )
}
