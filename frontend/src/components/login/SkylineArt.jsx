// Inline-SVG neighborhood: sun, drifting clouds, layered buildings, trees, street lamps, road.
// Colors come only from theme tokens via Tailwind fill/stroke utilities; motion is on <g> wrappers (transform only).
const BACK = [[10, 120, 50], [70, 90, 44], [128, 135, 60], [200, 100, 46], [260, 125, 54], [326, 85, 48], [388, 130, 62], [462, 105, 50], [526, 118, 56]]
const MID = [[0, 70, 56], [66, 110, 46], [124, 80, 62], [200, 120, 52], [268, 78, 58], [340, 105, 50], [404, 74, 64], [480, 112, 48], [540, 84, 60]]
const FRONT = [[24, 60, 70], [122, 88, 56], [226, 52, 74], [334, 78, 62], [440, 58, 70], [534, 74, 52]]

export default function SkylineArt({ className = '' }) {
  return (
    <svg viewBox="0 0 600 320" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true" focusable="false">
      <g className="animate-float"><circle cx="470" cy="84" r="34" className="fill-warn" /><circle cx="470" cy="84" r="52" className="fill-warn opacity-30" /></g>
      <g className="animate-driftx"><ellipse cx="120" cy="70" rx="46" ry="14" className="fill-card opacity-90" /><ellipse cx="148" cy="58" rx="28" ry="12" className="fill-card opacity-90" /></g>
      <g className="animate-driftx" style={{ animationDuration: '27s', animationDelay: '-9s' }}><ellipse cx="330" cy="40" rx="40" ry="12" className="fill-card opacity-80" /><ellipse cx="354" cy="30" rx="24" ry="10" className="fill-card opacity-80" /></g>
      {BACK.map(([x, h, w]) => <rect key={`b${x}`} x={x} y={250 - h} width={w} height={h} rx="3" className="fill-primary opacity-20" />)}
      {MID.map(([x, h, w]) => <rect key={`m${x}`} x={x} y={250 - h} width={w} height={h} rx="3" className="fill-primary opacity-40" />)}
      {FRONT.map(([x, h, w]) => (
        <g key={`f${x}`}>
          <rect x={x} y={250 - h - 40} width={w} height={h + 40} rx="4" className="fill-primary" />
          {[0, 1, 2].map((r) => [0, 1].map((c) => (
            <rect key={`${r}${c}`} x={x + 12 + c * (w / 2 - 6)} y={250 - h - 28 + r * 24} width="10" height="12" rx="2" className="fill-primary-foreground opacity-40" />
          )))}
        </g>
      ))}
      {[[70, 232], [300, 236], [498, 232]].map(([x, y]) => (
        <g key={`t${x}`}><rect x={x - 2} y={y} width="4" height="18" className="fill-primary" /><circle cx={x} cy={y - 6} r="16" className="fill-primary opacity-80" /></g>
      ))}
      <rect x="0" y="250" width="600" height="70" className="fill-foreground opacity-85" />
      <line x1="0" y1="286" x2="600" y2="286" strokeWidth="3" strokeDasharray="22 18" className="stroke-card opacity-70" />
      {[96, 268, 440].map((x, i) => (
        <g key={`l${x}`}>
          <line x1={x} y1="250" x2={x} y2="196" strokeWidth="3" className="stroke-foreground" />
          <line x1={x} y1="196" x2={x + 16} y2="196" strokeWidth="3" className="stroke-foreground" />
          <circle cx={x + 16} cy="202" r="10" className="fill-warn animate-glow" style={{ animationDelay: `${i * 0.8}s` }} />
        </g>
      ))}
    </svg>
  )
}
