// 위성사진 타일 몇 장으로 그린 작은 지도(지도 라이브러리 없이, 서버에서 그린다): 가운데에 건물 핀
const TILE = 256
const MAX_LAT = 85.05112878

export default function MiniMap({ lat, lng, zoom = 17, height = 120, label }: { lat: number; lng: number; zoom?: number; height?: number; label?: string }) {
  // 위경도 → 웹 메르카토르 전역 픽셀 좌표(극지방은 메르카토르 범위로 자른다)
  const z = Math.max(0, Math.min(19, Math.round(zoom)))
  const n = 2 ** z * TILE
  const px = ((lng + 180) / 360) * n
  const s = Math.sin((Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180)
  const py = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n
  const count = 2 ** z
  // 폭은 화면마다 달라서 가운데 기준 ±240px, 높이는 ±height/2를 덮는 타일만 깐다(세로 범위 밖 타일은 없다)
  const tiles: { x: number; y: number }[] = []
  for (let x = Math.floor((px - 240) / TILE); x <= Math.floor((px + 240) / TILE); x++)
    for (let y = Math.floor((py - height / 2) / TILE); y <= Math.floor((py + height / 2) / TILE); y++)
      if (y >= 0 && y < count) tiles.push({ x, y })
  return (
    <div className="relative overflow-hidden rounded-2xl bg-navy-deep" style={{ height }}>
      {tiles.map(({ x, y }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${x}-${y}`} src={`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${((x % count) + count) % count}`} alt="" width={TILE} height={TILE}
          decoding="async" draggable={false} className="absolute max-w-none select-none" style={{ left: `calc(50% + ${x * TILE - px}px)`, top: `calc(50% + ${y * TILE - py}px)` }} />
      ))}
      <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center" aria-hidden>
        {label && <span className="mb-1 whitespace-nowrap rounded-lg bg-teal px-2 py-1 text-[12px] font-bold text-white shadow">{label}</span>}
        <span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-teal shadow" />
      </span>
      <span className="absolute bottom-1 right-2 text-[9px] text-white/70">© Esri</span>
    </div>
  )
}
