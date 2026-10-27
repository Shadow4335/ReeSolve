import { useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png'
import shadow from 'leaflet/dist/images/marker-shadow.png'
import { api } from '../api'
import { DEMO_CENTER, DEMO_SCENARIO_ORIGIN } from '../constants'

L.Icon.Default.mergeOptions({ iconUrl: icon, iconRetinaUrl: iconRetina, shadowUrl: shadow })

function ClickToMove({ onMove }) {
  useMapEvents({ click: (e) => onMove([e.latlng.lat, e.latlng.lng]) })
  return null
}

function PinMap({ pos, setPos }) {
  const ref = useRef(null)
  const handlers = useMemo(
    () => ({ dragend() { const m = ref.current; if (m) { const p = m.getLatLng(); setPos([p.lat, p.lng]) } } }),
    [setPos],
  )
  return (
    <MapContainer center={pos} zoom={15} scrollWheelZoom={false} style={{ height: 320 }} className="rounded-lg shadow">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickToMove onMove={setPos} />
      <Marker draggable position={pos} ref={ref} eventHandlers={handlers} />
    </MapContainer>
  )
}

function Decision({ result, onTrack }) {
  const { incident, decision, explanation, cluster } = result
  const dup = decision === 'duplicate'
  return (
    <div className="space-y-3 rounded-xl border-4 border-blue-500 bg-blue-50 p-5">
      <h3 className="text-2xl font-extrabold text-blue-900">
        {dup
          ? `Merged with an existing incident (${incident.report_count} reports, ${explanation.distance_m} m away, similarity ${explanation.text_similarity})`
          : 'New incident created'}
      </h3>
      <p className="text-lg">
        <b>#{incident.id}</b> {incident.summary}
        <br />
        Category <b>{incident.category.replace('_', ' ')}</b> · priority <b>{incident.priority}</b>
      </p>
      {dup && <p className="text-sm text-slate-700">Why: {explanation.rule.replace(/_/g, ' ')}, score {explanation.score}.</p>}
      {cluster && (
        <p className="rounded bg-purple-100 p-3 text-purple-900">
          <b>Related to a nearby incident:</b> {cluster.coordination_note}
        </p>
      )}
      <button onClick={onTrack} className="rounded-lg bg-blue-700 px-5 py-3 text-lg font-bold text-white">Track this incident</button>
    </div>
  )
}

export default function Report({ onSubmitted }) {
  const [pos, setPos] = useState(DEMO_CENTER)
  const [mapKey, setMapKey] = useState(0) // bump to re-centre the map (demo location button)
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState('')
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const r = await api.post('/reports', {
        text, lat: pos[0], lng: pos[1], photo_url: photo || null, reporter_name: name || null,
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
    <div className="mx-auto max-w-3xl space-y-4">
      <h2 className="text-3xl font-extrabold">Report a problem</h2>
      <form onSubmit={submit} className="space-y-3">
        <textarea
          className="h-28 w-full rounded-lg border p-3 text-lg"
          placeholder="Describe the problem (e.g. Huge pothole on Rosewood Lane near the bakery)"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="rounded bg-slate-700 px-3 py-2 text-white" onClick={() => { setPos(DEMO_SCENARIO_ORIGIN); setMapKey((k) => k + 1) }}>Use demo location</button>
          <span className="text-sm text-slate-600">Pin: {pos[0].toFixed(5)}, {pos[1].toFixed(5)} (drag the pin or click the map)</span>
        </div>
        <PinMap key={mapKey} pos={pos} setPos={setPos} />
        <div className="grid gap-3 md:grid-cols-2">
          <input className="rounded border p-2" placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="rounded border p-2" placeholder="Photo URL (optional)" value={photo} onChange={(e) => setPhoto(e.target.value)} />
        </div>
        <button disabled={busy || text.trim().length < 3} className="rounded-lg bg-blue-700 px-6 py-3 text-xl font-bold text-white disabled:opacity-50">
          Submit report
        </button>
        {err && <p className="font-semibold text-red-700">{err}</p>}
      </form>
      {result && <Decision result={result} onTrack={() => onSubmitted(result.incident.id, result.report.id)} />}
    </div>
  )
}
