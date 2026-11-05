'use client'
// 실내 지도: 건물 가까이에서 "실내 지도 보기"를 누르면 지도 위에 뜬다.
// 1층 입구 → 엘리베이터 길을 먼저 보여 주고, "N층으로 이동"을 누르면 가는 층의 엘리베이터 → 강의실 길로 바뀐다.
// 안내도 이미지가 없는 건물·층은 간단한 약도로 같은 순서를 보여 준다. 휴대폰 방향(안내도 위 화살표·"내 방향에 맞추기" 회전)
import { ArrowUp, Compass, Elevator, MapTrifold, Stairs } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { t, type Lang } from '@/lib/i18n'
import { floorOf, headingOnPlan, indoorFloors, indoorRoute, type IndoorLeg, type IndoorPlan, type IndoorPoint } from '@/lib/map/indoor'
import type { HeadingStatus } from './useHeading'

type Props = {
  lang: Lang; plan: IndoorPlan; name: string
  /** 이 건물로 가는 중이면 가는 호실과 층 */ room?: { roomNo: string | null; floor: number | null } | null
  heading: number | null; headingStatus: HeadingStatus; canHeading: boolean; onHeading: () => void
  onClose: () => void
}

const pct = (p: IndoorPoint) => ({ left: `${p.x * 100}%`, top: `${p.y * 100}%` })

/** 단계 문구: 1층 입구 → 엘리베이터 / 엘리베이터로 N층 / N층 엘리베이터 → 호실 */
function legText(lang: Lang, l: IndoorLeg, roomNo: string | null) {
  if (l.from === 'entrance' && l.to === 'room') return t(lang, 'stepEntranceToRoom', { floor: l.floor, room: roomNo ?? '' })
  if (l.from === 'entrance') return t(lang, 'stepToElevator', { floor: l.floor })
  return t(lang, 'stepToRoom', { floor: l.floor, room: roomNo ?? '' })
}

export default function IndoorMap({ lang, plan, name, room, heading, headingStatus, canHeading, onHeading, onClose }: Props) {
  const route = useMemo(() => indoorRoute(plan, room), [plan, room])
  const floors = indoorFloors(plan, route.floor)
  // 처음엔 1층(입구가 있는 층)부터
  const [floorNo, setFloorNo] = useState(route.legs[0].floor)
  const [up, setUp] = useState(true)
  const [ratio, setRatio] = useState<number | null>(null)
  const [broken, setBroken] = useState<string | null>(null)
  const floor = floorOf(plan, floorNo)
  const legIdx = route.legs.findIndex(l => l.floor === floorNo)
  const cur = legIdx >= 0 ? route.legs[legIdx] : null
  const nextLeg = legIdx >= 0 ? route.legs[legIdx + 1] : undefined
  const prevLeg = legIdx > 0 ? route.legs[legIdx - 1] : undefined
  const sketch = !floor.image || broken === floor.image
  const onPlan = heading == null ? null : headingOnPlan(heading, floor)
  // "내 방향에 맞추기": 안내도를 돌려서 화면 위쪽이 내가 바라보는 쪽이 되게 한다(약도는 방위를 몰라 돌리지 않는다)
  const spin = up && onPlan != null && !sketch ? -onPlan : 0
  const start = cur?.path[0]
  const end = cur?.path[cur.path.length - 1]
  const boxRatio = sketch ? 3 / 4 : ratio

  return (
    <div role="dialog" aria-label={`${name} ${t(lang, 'indoorMap')}`} className="absolute inset-0 z-[1200] flex flex-col bg-bg">
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
            <button key={n} type="button" role="tab" aria-selected={n === floorNo} onClick={() => setFloorNo(n)}
              className={`press h-9 shrink-0 rounded-full px-4 text-[14px] font-bold ${n === floorNo ? 'bg-navy text-white' : 'bg-bg-soft text-ink'}`}>
              {t(lang, 'floorN', { n })}
            </button>
          ))}
        </div>
      )}

      {/* 단계: 1층 입구 → 엘리베이터 / 엘리베이터로 N층 / N층 엘리베이터 → 호실 */}
      <ol aria-label={t(lang, 'indoorMap')} className="mx-4 mb-2 space-y-1 rounded-2xl bg-mint-soft px-4 py-2.5 text-[14px] font-semibold text-mint-text">
        {route.legs.map((l, i) => (
          <li key={i} className="contents">
            {i > 0 && (
              <p className="flex items-center gap-2 opacity-70"><Elevator size={16} weight="bold" aria-hidden />{t(lang, 'stepRide', { floor: l.floor })}</p>
            )}
            <p aria-current={i === legIdx ? 'step' : undefined} className={`flex items-center gap-2 ${i === legIdx ? 'text-[15px] font-bold text-ink' : 'opacity-70'}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${i === legIdx ? 'bg-teal text-white' : 'bg-white text-mint-text'}`}>{i + 1}</span>
              {legText(lang, l, route.roomNo)}
            </p>
          </li>
        ))}
      </ol>

      {/* 안내도: 비율을 지키며 칸에 꽉 차게. 경로·표시는 이미지 위 비율(0~1)이라 같은 상자 안에 둔다 */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-bg-soft [container-type:size]">
        <div className="absolute inset-0 flex items-center justify-center p-3">
          <div className="relative transition-transform duration-200 ease-linear"
            style={{
              width: boxRatio ? `min(100cqw - 24px, calc((100cqh - 24px) * ${boxRatio}))` : '100%',
              aspectRatio: boxRatio ?? undefined,
              // 돌리면 모서리가 잘리지 않게 조금 줄인다
              transform: `rotate(${spin}deg) scale(${spin ? 0.78 : 1})`,
            }}>
            {sketch ? (
              // 약도: 바깥 벽, 가운데 세로 복도
              <div data-testid="indoor-sketch" className="absolute inset-0 rounded-2xl border-2 border-line bg-bg" aria-hidden>
                <div className="absolute inset-y-[6%] left-[42%] right-[42%] rounded-lg bg-bg-soft" />
              </div>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- 원본 비율을 읽어야 해서 일반 img를 쓴다 */}
                <img src={floor.image} alt={`${name} ${t(lang, 'floorN', { n: floor.floor })}`} className="block h-full w-full select-none object-contain" draggable={false}
                  onLoad={e => setRatio(e.currentTarget.naturalWidth / Math.max(1, e.currentTarget.naturalHeight))}
                  onError={() => setBroken(floor.image ?? null)} />
              </>
            )}

            {cur && (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
                <polyline data-testid="indoor-path" points={cur.path.map(p => `${p.x * 100},${p.y * 100}`).join(' ')} fill="none" stroke="var(--teal)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                <polyline points={cur.path.map(p => `${p.x * 100},${p.y * 100}`).join(' ')} fill="none" stroke="#fff" strokeWidth={1.5} strokeDasharray="2 6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
            )}

            {/* 출발점: 입구면 현재 위치(방향 부채꼴), 엘리베이터면 엘리베이터 */}
            {cur && start && (cur.from === 'entrance' ? (
              <span className="absolute -translate-x-1/2 -translate-y-1/2" style={pct(start)} aria-label={t(lang, 'youAreHere')}>
                {onPlan != null && !sketch && <span className="absolute left-1/2 top-1/2 h-16 w-16 rounded-full" aria-hidden
                  style={{ transform: `translate(-50%,-50%) rotate(${onPlan}deg)`, background: 'conic-gradient(from -32deg,rgba(59,130,246,.55),rgba(59,130,246,.12) 64deg,transparent 64deg)', maskImage: 'radial-gradient(circle,#000 0 70%,transparent 71%)' }} />}
                <span className="relative block h-4 w-4 rounded-full border-[3px] border-white bg-[#3b82f6] shadow" />
                <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-bg px-2 py-0.5 text-[12px] font-bold shadow" style={{ transform: `translateX(-50%) rotate(${-spin}deg)` }}>{t(lang, 'indoorEntrance')}</span>
              </span>
            ) : (
              <span className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg bg-navy text-white shadow" style={pct(start)} aria-label={t(lang, 'indoorElevator')}>
                <Elevator size={18} weight="bold" aria-hidden />
              </span>
            ))}

            {/* 도착점: 엘리베이터 또는 호실 */}
            {cur && end && (cur.to === 'elevator' ? (
              <span className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg bg-navy text-white shadow" style={pct(end)} aria-label={t(lang, 'indoorElevator')}>
                <Elevator size={18} weight="bold" aria-hidden />
              </span>
            ) : (
              <span className="absolute -translate-x-1/2 -translate-y-full" style={pct(end)}>
                <span className="block whitespace-nowrap rounded-full bg-danger px-2.5 py-1 text-[13px] font-bold text-white shadow" style={{ transform: `rotate(${-spin}deg)` }}>{route.roomNo}</span>
                <span className="mx-auto block h-2.5 w-2.5 rotate-45 bg-danger" aria-hidden style={{ marginTop: -5 }} />
              </span>
            ))}

            {/* 길이 없는 층(가는 층이 아닌 층): 계단·엘리베이터만 */}
            {!cur && (floor.elevator ? [floor.elevator] : floor.stairs ?? []).map((s, i) => (
              <span key={i} className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg bg-navy text-white" style={pct(s)} aria-hidden>
                <Stairs size={16} weight="bold" />
              </span>
            ))}
          </div>
        </div>

        {/* 방위: 안내도 위쪽 기준 북쪽, 휴대폰이 가리키는 쪽(약도는 방위를 몰라 숨긴다) */}
        {!sketch && (
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
        )}
        {(sketch || cur?.sketch) && <p className="absolute inset-x-3 top-2 text-center text-[12px] text-muted">{t(lang, 'indoorSketch')}</p>}
      </div>

      <div className="space-y-2 px-4 py-3">
        {/* 다음 층으로: 1층 길을 다 보면 바로 가는 층(엘리베이터 → 호실)으로 */}
        {nextLeg ? (
          <button type="button" onClick={() => setFloorNo(nextLeg.floor)} className="press flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-teal text-[17px] font-bold text-white">
            <Elevator size={20} weight="bold" aria-hidden />{t(lang, 'goToFloor', { floor: nextLeg.floor })}
          </button>
        ) : prevLeg ? (
          <button type="button" onClick={() => setFloorNo(prevLeg.floor)} className="press flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-bg-soft text-[15px] font-bold">
            {t(lang, 'backToFloor', { floor: prevLeg.floor })}
          </button>
        ) : null}
        <div className="flex items-center gap-2">
          {sketch ? null : heading != null ? (
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
          {plan.source && <p className="ml-auto text-right text-[12px] text-[#8b93a1]">{t(lang, 'indoorSource', { src: plan.source })}</p>}
        </div>
      </div>
    </div>
  )
}
