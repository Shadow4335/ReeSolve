import { useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import { api } from '../api'
import Icon from '../components/Icon'
import { Button, Card, Chip, IconTile, PageHeader } from '../components/ui'
import { useT } from '../i18n'
import { DEMO_CENTER, DEMO_SCENARIO_ORIGIN } from '../constants'
import { DEPT_BY_CATEGORY, REPORT_CATEGORIES } from '../lib/friendly'

// Inline-SVG pin (navy with a saffron centre; colours come from CSS variables): no image files, so it cannot break under the bundler.
const pinIcon = L.divIcon({
  className: '',
  iconSize: [36, 46],
  iconAnchor: [18, 44],
  html: `<svg width="36" height="46" viewBox="0 0 36 46" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
    <path d="M18 2C9.7 2 3 8.6 3 16.8 3 27.5 18 44 18 44s15-16.5 15-27.2C33 8.6 26.3 2 18 2z" style="fill:var(--navy-700);stroke:var(--white)" stroke-width="2.5"/>
    <circle cx="18" cy="17" r="6" style="fill:var(--saffron)"/></svg>`,
})

function ClickToMove({ onMove }) {
  useMapEvents({ click: (e) => onMove([e.latlng.lat, e.latlng.lng]) })
  return null
}

function PinMap({ pos, setPos }) {
  const ref = useRef(null)
  const handlers = useMemo(() => ({ dragend() { const m = ref.current; if (m) { const p = m.getLatLng(); setPos([p.lat, p.lng]) } } }), [setPos])
  return (
    <MapContainer center={pos} zoom={15} scrollWheelZoom={false} style={{ height: 280 }} className="rounded-xl">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickToMove onMove={setPos} />
      <Marker draggable icon={pinIcon} position={pos} ref={ref} eventHandlers={handlers} />
    </MapContainer>
  )
}

function Step({ n, title, sub, children }) {
  return (
    <Card className="p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-navy-700 text-sm font-semibold text-white">{n}</span>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{sub}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  )
}

const input = 'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary'

function Decision({ result, onFollow }) {
  const t = useT()
  const { incident, decision, explanation, cluster } = result
  const dup = decision === 'duplicate'
  return (
    <Card className="border-navy-700 bg-navy-50 p-6">
      <Chip tone="ok" dot={false}><Icon name="check" className="h-3.5 w-3.5" /> Report received</Chip>
      <h2 className="mt-3 text-2xl font-semibold">
        {dup ? `You're one of ${incident.report_count} residents who reported this` : 'Thanks. Your report is in.'}
      </h2>
      <p className="mt-2">
        {dup
          ? `We merged it with a report ${explanation.distance_m} m away (similarity ${explanation.text_similarity}), so it counts for more.`
          : `We've sent it to ${DEPT_BY_CATEGORY[incident.category]}.`}
        {' '}Priority: <b>{incident.priority.toLowerCase()}</b>.
      </p>
      {dup && <p className="mt-1 text-xs text-muted-foreground">Why: {explanation.rule.replace(/_/g, ' ')}, score {explanation.score}.</p>}
      {cluster && (
        <p className="mt-3 rounded-xl bg-card p-3 text-sm">
          <b>Linked to a related problem nearby.</b> {cluster.coordination_note}
        </p>
      )}
      <Button className="mt-5" onClick={() => onFollow(incident.id, result.report.id)}>{t('btn.follow')} <Icon name="arrow" className="h-4 w-4" /></Button>
    </Card>
  )
}

export default function Report({ category, onFollow }) {
  const t = useT()
  const [cat, setCat] = useState(category)
  const [pos, setPos] = useState(DEMO_CENTER)
  const [mapKey, setMapKey] = useState(0)
  const [landmark, setLandmark] = useState('')
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [photo, setPhoto] = useState('')
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [geoMsg, setGeoMsg] = useState('')

  const picked = REPORT_CATEGORIES.find((c) => c.key === cat)
  const move = (p, recenter = false) => { setPos(p); if (recenter) setMapKey((k) => k + 1) }

  const useMyLocation = () => {
    setGeoMsg('')
    if (!navigator.geolocation) return setGeoMsg('Location is not available in this browser. Tap the map instead.')
    navigator.geolocation.getCurrentPosition(
      (g) => move([g.coords.latitude, g.coords.longitude], true),
      () => setGeoMsg('Could not get your location. Tap the map to mark the spot.'),
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const full = landmark.trim() ? `${text.trim()} (near ${landmark.trim()})` : text.trim()
      const r = await api.post('/reports', {
        text: full, lat: pos[0], lng: pos[1], photo_url: photo || null, reporter_name: name || null,
        reporter_contact: contact || null, category_hint: picked?.hint || null,
      })
      setResult(r)
      setText('')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader eyebrow={t('report.eyebrow')} title={t('report.title')} sub={t('report.sub')} />
      <form onSubmit={submit} className="space-y-5">
        <Step n={1} title="What kind of problem is it?" sub="Pick the closest match. We'll route it for you.">
          <div className="grid gap-3 sm:grid-cols-2">
            {REPORT_CATEGORIES.map((c) => (
              <button
                type="button" key={c.key} onClick={() => setCat(c.key)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left ${cat === c.key ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-muted'}`}
              >
                <IconTile name={c.icon} className="h-10 w-10" />
                <span><span className="block text-sm font-semibold">{c.title}</span><span className="block text-xs text-muted-foreground">{c.sub}</span></span>
              </button>
            ))}
          </div>
        </Step>

        <Step n={2} title="Where is it?" sub="A street name, nearby landmark, or your current location.">
          <label className="text-sm font-medium">Location</label>
          <div className="mt-1 flex flex-wrap gap-2">
            <input className={`${input} min-w-[220px] flex-1`} placeholder="e.g. Ashoka Road, opposite Gurudwara Bangla Sahib" value={landmark} onChange={(e) => setLandmark(e.target.value)} />
            <Button type="button" variant="soft" onClick={useMyLocation}><Icon name="locate" className="h-4 w-4" /> Use my location</Button>
            <Button type="button" variant="soft" onClick={() => move(DEMO_SCENARIO_ORIGIN, true)}><Icon name="pin" className="h-4 w-4" /> Use demo location</Button>
          </div>
          {geoMsg && <p className="mt-2 text-sm text-destructive">{geoMsg}</p>}
          <p className="mb-2 mt-3 text-sm text-muted-foreground">Optional: tap the map or drag the pin to mark the spot. ({pos[0].toFixed(5)}, {pos[1].toFixed(5)})</p>
          <PinMap key={mapKey} pos={pos} setPos={setPos} />
        </Step>

        <Step n={3} title="Add a photo (optional)" sub="A clear photo helps the team find and fix it faster.">
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-background p-3">
            <Icon name="camera" className="h-5 w-5 text-muted-foreground" />
            <input className="flex-1 bg-transparent text-sm outline-none" placeholder="Paste a photo link (https://...)" value={photo} onChange={(e) => setPhoto(e.target.value)} />
          </div>
        </Step>

        <Step n={4} title="Describe the problem" sub="What's wrong, how long it's been there, and if it's dangerous.">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className={`${input} mt-1 h-28`} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={picked?.example || 'Huge pothole on Ashoka Road near Gurudwara Bangla Sahib'}
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className="text-sm font-medium">Your name (optional)</label><input className={`${input} mt-1`} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label className="text-sm font-medium">Phone or email (optional)</label><input className={`${input} mt-1`} value={contact} onChange={(e) => setContact(e.target.value)} /></div>
          </div>
        </Step>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">In danger right now? <b className="text-destructive">Call 112</b> for emergency services.</p>
          <Button disabled={busy || text.trim().length < 3}>{busy ? 'Submitting…' : t('btn.submit')}</Button>
        </div>
        {err && <p className="font-semibold text-destructive">{err}</p>}
      </form>
      {result && <div className="mt-6 pb-6"><Decision result={result} onFollow={onFollow} /></div>}
    </div>
  )
}
