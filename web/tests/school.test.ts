// 강원대 사이트 HTML(2026-10-20 저장본)에서 삼척 공지·식단을 읽어 내는 파서 테스트
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseNoticeList, parseNoticeBody, parseNoticeDetail, getNotices, safeHttpUrl, postedToday, dDay } from '@/lib/school/notices'
import { currentMeal, getMenu, parseMenu, servedOn, todayIndex } from '@/lib/school/menu'
import { addDays, createMemo, decodeBody, kstDay, msToKstMidnight } from '@/lib/school/memo'

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}.html`, import.meta.url), 'utf8')

describe('공지 파서', () => {
  it('학사공지 첫 글은 삼척 전과 모집 공고', () => {
    const list = parseNoticeList(fx('notice-academic-list'), 'academic')
    expect(list[0]).toMatchObject({ id: '2598', date: '2026.10.19', dept: '삼척교육지원과', board: 'academic' })
    expect(list[0].title).toContain('2027학년도 전과 모집 공고')
    expect(list[0].url).toBe('https://www.kangwon.ac.kr/ko/bbs/720/detail.do?pstSn=2598')
  })
  it('일반공지도 1건 이상', () => {
    expect(parseNoticeList(fx('notice-general-list'), 'general').length).toBeGreaterThan(0)
  })
  it('일반공지는 작성자 칸이 없다: 부서는 비우고 날짜 칸에 조회수가 들어가지 않는다', () => {
    const list = parseNoticeList(fx('notice-general-list'), 'general')
    for (const n of list) {
      expect(n.date).toMatch(/^\d{4}\.\d{2}\.\d{2}/)
      expect(n.dept).toBe('')
    }
    expect(list[0].date).toBe('2026.10.19')
  })
  it('머리글이 없는 옛 형식 표는 제목 뒤 칸 순서로 읽는다', () => {
    const html = '<table><tr><td><span aria-label="삼척">삼척</span></td><td><a class="detail-button" data-sn="7">제목</a></td><td>학생과</td><td>2026.11.01</td></tr></table>'
    expect(parseNoticeList(html, 'academic')[0]).toMatchObject({ dept: '학생과', date: '2026.11.01' })
  })
  it('상세 본문은 태그 없는 텍스트, 이미지 공지면 이미지 설명과 첨부 파일 이름을 담는다', () => {
    const body = parseNoticeBody(fx('notice-academic-detail'))
    expect(body).not.toContain('<')
    expect(body).toContain('전과모집공고')
    expect(body).toContain('2027학년도 전과전형공고_삼척캠퍼스.hwp')
    expect(body).not.toMatch(/chevron_forward|download|file_present/)
  })
  it('상세에서 실제 본문 글자와 첨부 파일 이름을 따로 뽑는다(AI 없이 보여 줄 정보)', () => {
    const d = parseNoticeDetail(fx('notice-academic-detail'))
    expect(d.files).toContain('2027학년도 전과전형공고_삼척캠퍼스.hwp')
    expect(d.text).not.toMatch(/\[첨부\]|\[이미지\]|chevron_forward/)
    expect(d.images).toBeGreaterThan(0)
  })
  it('빈 HTML은 빈 목록', () => {
    expect(parseNoticeList('<html></html>', 'academic')).toEqual([])
  })
  it('사이트가 비거나 실패하면 스냅샷', async () => {
    const r = await getNotices('academic', 5, async () => '<html></html>')
    expect(r.source).toBe('snapshot')
    expect(r.items.length).toBeGreaterThan(0)
    const r2 = await getNotices('academic', 5, async () => { throw new Error('down') })
    expect(r2.source).toBe('snapshot')
  })
})

describe('식단 파서', () => {
  const week = parseMenu(fx('menu-samcheok'))
  it('삼척 5공학관식당 이번 주', () => {
    expect(week.restaurant).toBe('삼척-5공학관식당')
    expect(week.days[0]).toBe('10.19(월)')
  })
  it('코너와 메뉴', () => {
    const names = week.corners.map(c => c.name)
    for (const n of ['덮밥류', '백반', '천원의아침밥', '특선메뉴']) expect(names).toContain(n)
    const rice = week.corners.find(c => c.name === '덮밥류')!
    expect(rice.price).toBe('5,000원')
    expect(rice.meals.find(m => m.meal === '점심')!.byDay[0]).toContain('치킨마요덮밥')
  })
})

describe('todayIndex', () => {
  it('한국 시간 기준 오늘 열을 찾는다', () => {
    const days = ['10.19(월)', '10.20(화)']
    expect(todayIndex(days, new Date('2026-10-19T16:00:00Z'))).toBe(1)
    expect(todayIndex(days, new Date('2026-10-19T14:00:00Z'))).toBe(0)
    expect(todayIndex(days, new Date('2026-10-25T03:00:00Z'))).toBe(-1)
  })
  it('0이 붙은 날짜도 오늘로 찾는다', () => {
    expect(todayIndex(['01.05(월)', '01.06(화)'], new Date('2027-01-05T03:00:00Z'))).toBe(0)
  })
})

describe('학교 사이트가 이상해도 화면이 깨지지 않는다', () => {
  it('글 번호가 숫자가 아니면(주소 주입) 버린다', () => {
    const html = `<table><tr><td><span aria-label="삼척"></span></td><td><a class="detail-button" data-sn="1&x=javascript:alert(1)">제목</a></td><td>부서</td><td>2026.10.19</td></tr>
      <tr><td><span aria-label="삼척"></span></td><td><a class="detail-button" data-sn="42">제목2</a></td><td>부서</td><td>2026.10.20</td></tr></table>`
    expect(parseNoticeList(html, 'general').map(n => n.id)).toEqual(['42'])
  })
  it('링크는 http·https 주소만', () => {
    expect(safeHttpUrl('https://www.kangwon.ac.kr/x')).toBe('https://www.kangwon.ac.kr/x')
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpUrl('not a url')).toBeNull()
  })
  it('빈 상세 HTML은 빈 정보', () => {
    expect(parseNoticeDetail('')).toEqual({ text: '', images: 0, files: [] })
    expect(parseNoticeBody('')).toBe('')
  })
  it('식단은 저장본 없이: 비거나 실패하면 한 번 더 시도하고, 그래도 안 되면 error', async () => {
    const empty = vi.fn(async () => '<html></html>')
    expect(await getMenu(empty, Date.now(), 0)).toEqual({ week: null, source: 'error' })
    expect(empty).toHaveBeenCalledTimes(2)
    const down = vi.fn(async (): Promise<string> => { throw new Error('down') })
    expect((await getMenu(down, Date.now(), 0)).source).toBe('error')
    expect(down).toHaveBeenCalledTimes(2)
  })
  it('처음 실패해도 다시 시도해서 성공하면 live', async () => {
    let n = 0
    const flaky = async () => { if (n++ === 0) throw new Error('blip'); return fx('menu-samcheok') }
    const r = await getMenu(flaky, Date.now(), 0)
    expect(r.source).toBe('live')
    expect(n).toBe(2)
  })
  it('오늘(한국) 날짜가 든 주를 요청한다. 토요일은 다음 주, 일요일은 그날(사이트가 다음 월~금을 준다)', async () => {
    const urls: string[] = []
    const get = async (u: string) => { urls.push(u); return fx('menu-samcheok') }
    await getMenu(get, new Date('2026-11-05T15:30:00Z')) // 한국 11-06(금) 00:30
    await getMenu(get, new Date('2026-11-07T03:00:00Z')) // 한국 11-07(토)
    await getMenu(get, new Date('2026-11-08T03:00:00Z')) // 한국 11-08(일)
    expect(urls.map(u => new URL(u).searchParams.get('targetDate'))).toEqual(['20261106', '20261108', '20261108'])
    expect(urls.every(u => new URL(u).searchParams.get('campusCd') === '2')).toBe(true)
  })
  it('EUC-KR로 온 페이지도 글자가 깨지지 않는다', () => {
    const euckr = new Uint8Array([0xbb, 0xef, 0xc3, 0xb4]) // "삼척"
    const utf8 = () => new TextEncoder().encode('삼척').buffer as ArrayBuffer
    expect(decodeBody(euckr.buffer, 'text/html; charset=EUC-KR')).toBe('삼척')
    expect(decodeBody(utf8(), null)).toBe('삼척')
    expect(decodeBody(utf8(), 'text/html; charset=nope')).toBe('삼척')
  })
})

describe('식단 끼니', () => {
  it('운영안함·빈 칸은 나오는 메뉴가 아니다', () => {
    const byDay = [['운영안함'], [], ['백반']]
    expect([0, 1, 2, -1, 5].map(d => servedOn(byDay, d))).toEqual([[], [], ['백반'], [], []])
  })
  it('지금 끼니는 서버 시간대와 상관없이 한국 시간으로', () => {
    expect(currentMeal(new Date('2026-10-19T23:30:00Z'))).toBe('아침') // 한국 08:30
    expect(currentMeal(new Date('2026-10-20T03:00:00Z'))).toBe('점심') // 한국 12:00
    expect(currentMeal(new Date('2026-10-20T09:00:00Z'))).toBe('저녁') // 한국 18:00
  })
})

describe('공지 카드·식단 화면 데이터(service, 미리 만든 번역)', () => {
  const G = globalThis as Record<string, unknown>
  const resetGlobals = () => { for (const k of ['__uniSchoolMemo', '__uniLastMenu', '__uniMenuMemo', '__uniSchoolCache', '__uniPrebuiltRead', '__uniPrebuiltBusy']) delete G[k] }
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.doUnmock('server-only'); vi.doUnmock('@/lib/ai'); vi.resetModules(); resetGlobals() })
  const html = (body: string) => new Response(body, { headers: { 'content-type': 'text/html; charset=UTF-8' } })
  const schoolSite = () => {
    const list = fx('notice-academic-list'), detail = fx('notice-academic-detail'), menu = fx('menu-samcheok')
    const fetchMock = vi.fn(async (url: string) => html(url.includes('wkmenu') ? menu : url.includes('list.do') ? list : detail))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }
  /** AI 대역: 몇 번 불렸는지 센다 */
  const fakeAi = () => {
    const summarizeNotice = vi.fn(async (title: string, _b: string, lang: string) => ({ bullets: [`${lang}:${title}`], deadline: '11/17 18:00', apply: null }))
    const translateList = vi.fn(async (items: string[], lang: string) => items.map(x => `${lang}:${x}`))
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.doMock('@/lib/ai', () => ({ summarizeNotice, translateList }))
    return { summarizeNotice, translateList }
  }

  it('사이트가 죽고 저장본도 없으면 스냅샷 원문 카드', async () => {
    vi.doMock('server-only', () => ({}))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { noticeCards } = await import('@/lib/school/service')
    const r = await noticeCards('academic', 'en', 3)
    expect(r.source).toBe('snapshot')
    expect(r.items).toHaveLength(3)
    expect(r.items[0]).toMatchObject({ titleTr: r.items[0].title, bullets: [], excerpt: '' })
  })
  it('공지는 하루 한 번 다섯 언어로 미리 만들고, 화면은 저장본만 읽는다(요청 때 AI 호출 없음)', async () => {
    vi.doMock('server-only', () => ({}))
    schoolSite()
    const ai = fakeAi()
    const { buildNotices, NOTICE_LIMIT } = await import('@/lib/school/prebuilt')
    const { noticeCards } = await import('@/lib/school/service')
    const snaps = await buildNotices('academic')
    const n = snaps.ko.items.length
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThanOrEqual(NOTICE_LIMIT)
    expect(ai.summarizeNotice).toHaveBeenCalledTimes(n * 5)
    expect(ai.translateList).toHaveBeenCalledTimes(Math.ceil(n / 4) * 4) // 한국어 빼고 언어마다 제목을 4개씩 한 번
    const before = ai.summarizeNotice.mock.calls.length
    const r = await noticeCards('academic', 'vi', 3)
    expect(r.items[0]).toMatchObject({ titleTr: `vi:${r.items[0].title}`, bullets: [`vi:${r.items[0].title}`], deadline: '11/17 18:00' })
    expect(r.items[0].files.length).toBeGreaterThan(0)
    expect(ai.summarizeNotice).toHaveBeenCalledTimes(before)
  })
  it('다시 만들 때 이미 요약한 공지는 AI를 다시 부르지 않는다', async () => {
    vi.doMock('server-only', () => ({}))
    schoolSite()
    const ai = fakeAi()
    const { buildNotices } = await import('@/lib/school/prebuilt')
    await buildNotices('academic')
    const calls = ai.summarizeNotice.mock.calls.length
    const next = await buildNotices('academic', undefined, Date.now() + 86_400_000)
    expect(ai.summarizeNotice).toHaveBeenCalledTimes(calls)
    expect(next.en.items[0].bullets[0]).toMatch(/^en:/)
  })
  it('제목은 4개씩 나눠 번역하고, 번역이 안 된 묶음은 한 번 더 시도한다', async () => {
    vi.doMock('server-only', () => ({}))
    let flaky = true
    const translateList = vi.fn(async (items: string[], lang: string) => {
      if (flaky && items[0] === 'T4') { flaky = false; return items } // 두 번째 묶음이 처음엔 실패(원문 그대로)
      return items.map(x => `${lang}:${x}`)
    })
    vi.doMock('@/lib/ai', () => ({ summarizeNotice: vi.fn(), translateList }))
    const { translateTitles } = await import('@/lib/school/prebuilt')
    const titles = Array.from({ length: 8 }, (_, i) => `T${i}`)
    const out = await translateTitles(titles, 'uz')
    expect(out).toEqual(titles.map(x => `uz:${x}`))
    expect(translateList.mock.calls.map(c => c[0].length)).toEqual([4, 4, 4]) // 4개씩 두 번 + 실패한 묶음 한 번 더
  })
  it('retitle이면 저장된 제목을 모두 다시 번역하되 요약은 다시 만들지 않는다', async () => {
    vi.doMock('server-only', () => ({}))
    schoolSite()
    const ai = fakeAi()
    const { buildNotices } = await import('@/lib/school/prebuilt')
    await buildNotices('academic')
    const summaries = ai.summarizeNotice.mock.calls.length
    ai.translateList.mockImplementation(async (items: string[], lang: string) => items.map(x => `v2-${lang}:${x}`))
    const snaps = await buildNotices('academic', undefined, Date.now(), { retitle: true })
    expect(snaps.uz.items[0].titleTr).toBe(`v2-uz:${snaps.uz.items[0].title}`)
    expect(snaps.uz.items[0].bullets[0]).toMatch(/^uz:/)
    expect(ai.summarizeNotice).toHaveBeenCalledTimes(summaries)
  })
  it('학식: 식단은 사이트에서 받고(2분 공유), 메뉴 이름 번역은 주 1회 만든 사전에서 찾기만 한다', async () => {
    vi.doMock('server-only', () => ({}))
    const fetchMock = schoolSite()
    const ai = fakeAi()
    const { buildMenu } = await import('@/lib/school/prebuilt')
    const { menuView } = await import('@/lib/school/service')
    expect(await buildMenu()).toBe(true)
    expect(ai.translateList).toHaveBeenCalledTimes(4)
    const fetches = fetchMock.mock.calls.length
    const [en, ko] = await Promise.all([menuView('en'), menuView('ko')])
    expect(en.week?.tr['덮밥류']).toBe('en:덮밥류')
    expect(ko.week?.tr['덮밥류']).toBe('덮밥류')
    expect(ko.week?.days[0]).toBe('10.19(월)')
    await menuView('vi')
    expect(fetchMock.mock.calls.length - fetches).toBe(1) // 세 화면이 한 번 받은 식단을 같이 쓴다
    expect(ai.translateList).toHaveBeenCalledTimes(4) // 화면을 열어도 번역 호출 없음
    expect(await buildMenu()).toBe(true)
    expect(ai.translateList).toHaveBeenCalledTimes(4) // 사전에 있는 이름은 다시 번역하지 않는다
  })
  it('사전이 없으면 메뉴 이름은 원문 그대로 보여 준다', async () => {
    vi.doMock('server-only', () => ({}))
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('wkmenu') ? html(fx('menu-samcheok')) : Promise.reject(new Error('x')))))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { menuView } = await import('@/lib/school/service')
    const r = await menuView('en')
    expect(r.source).toBe('live')
    expect(r.week?.tr['덮밥류']).toBe('덮밥류')
  })
  it('식단을 못 받으면 옛 정보 없이 error', async () => {
    vi.doMock('server-only', () => ({}))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { menuView } = await import('@/lib/school/service')
    expect(await menuView('en')).toEqual({ week: null, source: 'error' })
  })
  it('사이트가 응답하지 않으면 같은 주에 받아 둔 식단을 받은 시각과 함께, 다른 주면 error', async () => {
    vi.doMock('server-only', () => ({}))
    const menu = fx('menu-samcheok')
    let up = true
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (!up) throw new Error('down')
      return html(menu)
    }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { menuView } = await import('@/lib/school/service')
    const wed = Date.UTC(2026, 10, 4, 3) // 11/4(수) 12:00 한국
    expect((await menuView('ko', wed)).source).toBe('live')
    up = false
    const fri = Date.UTC(2026, 10, 6, 3) // 같은 주 금요일
    const cached = await menuView('ko', fri)
    expect(cached).toMatchObject({ source: 'cached', at: wed })
    expect(cached.week?.days[0]).toBe('10.19(월)')
    // 토요일은 다음 주 식단을 보는 날이라 받아 둔 이번 주 식단을 쓰지 않는다
    const sat = Date.UTC(2026, 10, 7, 3)
    expect(await menuView('ko', sat)).toEqual({ week: null, source: 'error' })
  })
})

describe('한국 날짜(서버가 UTC여도)', () => {
  it('UTC 15시 이후는 이미 한국 다음 날', () => {
    expect(kstDay(new Date('2026-11-05T15:30:00Z'))).toMatchObject({ iso: '2026-11-06', dow: 5 })
    expect(kstDay(new Date('2026-11-05T14:59:00Z')).iso).toBe('2026-11-05')
    expect(todayIndex(['11.2(월)', '11.3(화)', '11.4(수)', '11.5(목)', '11.6(금)'], new Date('2026-11-05T15:30:00Z'))).toBe(4)
    expect(todayIndex(['11.2(월)', '11.3(화)', '11.4(수)', '11.5(목)', '11.6(금)'], new Date('2026-11-05T14:30:00Z'))).toBe(3)
  })
  it('주말이면 오늘 열이 없다', () => {
    expect(todayIndex(['11.9(월)', '11.10(화)'], new Date('2026-11-08T03:00:00Z'))).toBe(-1)
  })
  it('달·해 경계와 다음 자정까지 남은 시간', () => {
    expect(addDays(kstDay(new Date('2026-12-31T03:00:00Z')), 1).iso).toBe('2027-01-01')
    expect(msToKstMidnight(Date.parse('2026-11-05T14:59:00Z'))).toBe(60_000)
  })
  it('날짜가 바뀌면 어제 저장본을 바로 보여 주고 뒤에서 오늘 것을 다시 만든다', async () => {
    vi.doMock('server-only', () => ({}))
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(fx(String(url).includes('list.do') ? 'notice-academic-list' : 'notice-academic-detail'), { headers: { 'content-type': 'text/html' } })))
    try {
      const { createMemoryCacheStore } = await import('@/lib/school/cache-store')
      const { buildNotices, readNotices, noticeKey } = await import('@/lib/school/prebuilt')
      const store = createMemoryCacheStore()
      const night = Date.parse('2026-11-05T14:50:00Z') // 한국 23:50
      await buildNotices('academic', store, night)
      expect((await readNotices('academic', 'ko', 1, night, store)).status).toBe('prebuilt')
      const next = Date.parse('2026-11-05T15:01:00Z') // 한국 다음 날 00:01
      const r = await readNotices('academic', 'ko', 1, next, store)
      expect(r.status).toBe('stale')
      expect(r.items).toHaveLength(1)
      // 뒤에서 다시 만들었다(만든 시각이 바뀜)
      await vi.waitFor(async () => expect((await store.get<{ builtAt: number }>(noticeKey('academic', 'ko')))?.builtAt).not.toBe(night))
    } finally {
      vi.unstubAllGlobals(); vi.doUnmock('server-only'); vi.resetModules()
      for (const k of ['__uniSchoolMemo', '__uniLastMenu', '__uniMenuMemo', '__uniSchoolCache', '__uniPrebuiltRead', '__uniPrebuiltBusy']) delete (globalThis as Record<string, unknown>)[k]
    }
  })
})

describe('공지 날짜: 오늘 글·마감 D-day(한국 날짜)', () => {
  const now = new Date('2026-11-05T15:30:00Z') // 한국 11-06
  it('오늘 올라온 글', () => {
    expect(postedToday('2026.11.06', now)).toBe(true)
    expect(postedToday('2026.11.05', now)).toBe(false)
    expect(postedToday('', now)).toBe(false)
  })
  it('마감까지 남은 날', () => {
    expect(dDay('2026.11.09', now)).toBe('D-3')
    expect(dDay('11월 6일', now)).toBe('D-day')
    expect(dDay('2026-11-01', now)).toBeNull()
    expect(dDay('곧', now)).toBeNull()
  })
})

describe('학교 데이터 캐시', () => {
  it('같은 키를 동시에 요청하면 한 번만 만든다', async () => {
    const memo = createMemo(1000)
    let calls = 0
    const make = () => new Promise<number>(r => setTimeout(() => r(++calls), 5))
    expect(await Promise.all([memo('k', make), memo('k', make), memo('k', make)])).toEqual([1, 1, 1])
    expect(calls).toBe(1)
  })
  it('실패나 keep=false 결과는 저장하지 않는다', async () => {
    const memo = createMemo(1000)
    await expect(memo('k', async () => { throw new Error('x') })).rejects.toThrow()
    expect(await memo('k', async () => 'ok')).toBe('ok')
    let calls = 0
    const empty = async () => { calls++; return '' }
    await memo('e', empty, v => v !== '')
    await memo('e', empty, v => v !== '')
    expect(calls).toBe(2)
  })
  it('항목이 너무 많으면 오래된 것부터 지운다', async () => {
    const memo = createMemo(1000, () => 0, 2)
    let calls = 0
    for (const k of ['a', 'b', 'c']) await memo(k, async () => ++calls)
    await memo('a', async () => ++calls)
    expect(calls).toBe(4)
  })
})
