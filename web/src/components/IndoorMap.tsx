'use client'
// 실내 안내도: 건물 가까이(10m) 오면 지도 위에 뜬다. 층 고르기, 가는 호실 표시, 휴대폰 방향(안내도 위 화살표·"내 방향에 맞추기" 회전)
import { ArrowUp, Compass, MapTrifold, Stairs } from '@phosphor-icons/react'
import { useState } from 'react'
import { t, type Lang } from '@/lib/i18n'
import { headingOnPlan, startFloor, type IndoorPlan } from '@/lib/map/indoor'
import type { HeadingStatus } from './useHeading'

type Props = {
  lang: Lang; plan: IndoorPlan; name: string
  /** 이 건물로 가는 중이면 가는 호실과 층 */ room?: { roomNo: string | null; floor: number | null } | null
  heading: number | null; headingStatus: HeadingStatus; canHeading: boolean; onHeading: () => void
  onClose: () => void
}

export default function IndoorMap({ lang, plan, name, room, heading, headingStatus, canHeading, onHeading, onClose }: Props) {
  const [floorNo, setFloorNo] = useState(() => startFloor(plan, room?.floor))
  const [up, setUp] = useState(true)
  const [ratio, setRatio] = useState<number | null>(null)
  const [broken, setBroken] = useState<string | null>(null)
  const floor = plan.floors.find(f => f.floor === floorNo) ?? plan.floors[0]
  const floors = plan.floors.map(f => f.floor).sort((a, b) => a - b)
  const onPlan = heading == null ? null : headingOnPlan(heading, floor)
  // "내 방향에 맞추기": 안내도를 돌려서 화면 위쪽이 내가 바라보는 쪽이 되게 한다
  const spin = up && onPlan != null ? -onPlan : 0
  const target = room?.roomNo && room.floor === floor.floor ? floor.rooms?.[room.roomNo] : undefined
  const entrance = plan.entrances?.find(e => e.floor === floor.floor)
  const otherFloor = room?.floor != null && room.floor !== floor.floor
  const noImage = broken === floor.image

  return (
    <div role="dialog" aria-label={`${name} ${t(lang, 'indoorMap')}`} className="absolute inset-0 z-[700] flex flex-col bg-bg">
      <div className="flex items-center gap-3 px-4 pb-2 pt-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-teal">{t(lang, 'indoorMap')}</p>
          <p className="truncate text-[20px] font-bold tracking-tight">{name}</p>
        </div>
        <button type="button" onClick={onClose} className="press flex h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-bg-soft px-3.5 text-[14px] font-bold">
          <MapTrifold size={18} weight="bold" aria-hidden />{t(lang, 'outdoorMap')}
        </button>
      </div>

      {floors.length > 1 && (
        <div role="tablist" className="flex gap-1.5 overflow-x-auto px-4 pb-2">
          {floors.map(n => (
            <button key={n} type="button" role="tab" aria-selected={n === floor.floor} onClick={() => setFloorNo(n)}
              className={`press h-9 shrink-0 rounded-full px-4 text-[14px] font-bold ${n === floor.floor ? 'bg-navy text-white' : 'bg-bg-soft text-ink'}`}>
              {t(lang, 'floorN', { n })}
            </button>
          ))}
        </div>
      )}

      {room?.roomNo && room.floor != null && (
        <p className="mx-4 mb-2 flex items-center gap-2 rounded-2xl bg-mint-soft px-4 py-2.5 text-[15px] font-semibold text-mint-text">
          {otherFloor && <Stairs size={20} weight="bold" aria-hidden />}
          {otherFloor ? t(lang, 'goFloor', { floor: room.floor }) : t(lang, 'floorRoom', { floor: room.floor, room: room.roomNo })}
        </p>
      )}

      {/* 안내도: 비율을 지키며 칸에 꽉 차게. 위치 표시는 이미지 위 비율(0~1)이라 같은 상자 안에 둔다 */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-bg-soft [container-type:size]">
        {noImage ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-[15px] text-muted">{t(lang, 'indoorNoImage')}</p>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative transition-transform duration-200 ease-linear"
              style={{
                width: ratio ? `min(100cqw, calc(100cqh * ${ratio}))` : '100%',
                aspectRatio: ratio ?? undefined,
                // 돌리면 모서리가 잘리지 않게 조금 줄인다
                transform: `rotate(${spin}deg) scale(${spin ? 0.78 : 1})`,
              }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 원본 비율을 읽어야 해서 일반 img를 쓴다 */}
              <img src={floor.image} alt={`${name} ${t(lang, 'floorN', { n: floor.floor })}`} className="block h-full w-full select-none object-contain" draggable={false}
                onLoad={e => setRatio(e.currentTarget.naturalWidth / Math.max(1, e.currentTarget.naturalHeight))}
                onError={() => setBroken(floor.image)} />
              {target && (
                <span className="absolute -translate-x-1/2 -translate-y-full" style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}>
                  <span className="block whitespace-nowrap rounded-full bg-danger px-2.5 py-1 text-[13px] font-bold text-white shadow" style={{ transform: `rotate(${-spin}deg)` }}>{room?.roomNo}</span>
                  <span className="mx-auto block h-2.5 w-2.5 rotate-45 bg-danger" aria-hidden style={{ marginTop: -5 }} />
                </span>
              )}
              {otherFloor && floor.stairs?.map((s, i) => (
                <span key={i} className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg bg-navy text-white" style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }} aria-hidden>
                  <Stairs size={16} weight="bold" />
                </span>
              ))}
              {entrance && (
                <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${entrance.at.x * 100}%`, top: `${entrance.at.y * 100}%` }} aria-label={t(lang, 'youAreHere')}>
                  {onPlan != null && <span className="absolute left-1/2 top-1/2 h-16 w-16 rounded-full" aria-hidden
                    style={{ transform: `translate(-50%,-50%) rotate(${onPlan}deg)`, background: 'conic-gradient(from -32deg,rgba(59,130,246,.55),rgba(59,130,246,.12) 64deg,transparent 64deg)', maskImage: 'radial-gradient(circle,#000 0 70%,transparent 71%)' }} />}
                  <span className="relative block h-4 w-4 rounded-full border-[3px] border-white bg-[#3b82f6] shadow" />
                </span>
              )}
            </div>
          </div>
        )}

        {/* 방위: 안내도 위쪽 기준 북쪽, 휴대폰이 가리키는 쪽 */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bg shadow" aria-hidden>
            <span className="flex flex-col items-center text-[11px] font-bold leading-none text-danger" style={{ transform: `rotate(${-floor.north + spin}deg)` }}>N<ArrowUp size={16} weight="bold" /></span>
          </span>
          {onPlan != null && (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3b82f6] text-white shadow" aria-label={t(lang, 'goThisWay')}>
              <ArrowUp size={22} weight="bold" style={{ transform: `rotate(${onPlan + spin}deg)` }} />
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-3">
        {heading != null ? (
          <label className="press flex h-11 items-center gap-2 rounded-2xl bg-bg-soft px-3.5 text-[14px] font-semibold">
            <input type="checkbox" checked={up} onChange={e => setUp(e.target.checked)} className="h-5 w-5 accent-[var(--teal)]" />{t(lang, 'headingUp')}
          </label>
        ) : canHeading && headingStatus !== 'unsupported' && headingStatus !== 'denied' ? (
          <button type="button" onClick={onHeading} className="press flex h-11 items-center gap-1.5 rounded-2xl bg-[#3b82f6] px-3.5 text-[14px] font-bold text-white">
            <Compass size={18} weight="bold" aria-hidden />{t(lang, 'headingOn')}
          </button>
        ) : (headingStatus === 'unsupported' || headingStatus === 'denied') && (
          <p className="text-[13px] text-muted">{t(lang, 'headingNoSensor')}</p>
        )}
        <p className="ml-auto text-right text-[12px] text-[#8b93a1]">{t(lang, 'indoorSource', { src: plan.source })}</p>
      </div>
    </div>
  )
}
