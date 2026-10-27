import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { DEMO_CENTER } from '../constants'
import { fixedColor, outlineColor, priorityColor } from '../lib/theme'

// Residents' map: green = fixed; open ones use the priority colours (CRITICAL red, HIGH saffron, MEDIUM navy, LOW slate).
export default function MiniMap({ incidents, height = 300 }) {
  return (
    <MapContainer center={DEMO_CENTER} zoom={14} scrollWheelZoom={false} style={{ height }} className="rounded">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {incidents.map((i) => (
        <CircleMarker
          key={i.id}
          center={[i.lat, i.lng]}
          radius={8 + Math.min(i.report_count, 6)}
          pathOptions={{ color: outlineColor(), weight: 2, fillOpacity: 0.9, fillColor: i.status === 'RESOLVED' ? fixedColor() : priorityColor(i.priority) }}
        >
          <Popup>
            <b>{i.summary}</b>
            <br />
            {i.status === 'RESOLVED' ? 'Fixed' : 'Open'} · {i.priority} · {i.report_count} report(s)
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
