import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import { DEMO_CENTER } from '../constants'

// Residents' map: sage = fixed, terracotta = urgent and open, amber = open.
export default function MiniMap({ incidents, height = 300 }) {
  return (
    <MapContainer center={DEMO_CENTER} zoom={14} scrollWheelZoom={false} style={{ height }} className="rounded-xl">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {incidents.map((i) => {
        const fixed = i.status === 'RESOLVED'
        const urgent = i.priority === 'HIGH' || i.priority === 'CRITICAL'
        return (
          <CircleMarker
            key={i.id}
            center={[i.lat, i.lng]}
            radius={8 + Math.min(i.report_count, 6)}
            pathOptions={{
              color: '#fff', weight: 2, fillOpacity: 0.9,
              fillColor: fixed ? '#6b7a4f' : urgent ? '#c4573a' : '#d9a441',
            }}
          >
            <Popup>
              <b>{i.summary}</b>
              <br />
              {fixed ? 'Fixed' : 'Open'} · {i.report_count} report(s)
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
