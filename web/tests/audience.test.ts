// 방문객 모드 대상별 안내(방문객·주민·교직원)와 시설의 "누구나 이용" 표시
import { describe, expect, it } from 'vitest'
import { LANGS } from '@/lib/i18n'
import { buildingById } from '@/lib/map/buildings'
import { FACILITIES, facilitiesFor } from '@/lib/map/facilities'
import { AUDIENCE, audienceView } from '@/lib/visit'

describe('대상별 안내 자료', () => {
  it('묶음마다 다섯 언어 제목·설명이 있고, 건물과 시설이 실제로 있다', () => {
    expect(AUDIENCE.map(g => g.id)).toEqual(['visitor', 'resident', 'staff'])
    for (const g of AUDIENCE) {
      for (const { code } of LANGS) {
        expect(g.title[code]).toBeTruthy()
        expect(g.desc[code]).toBeTruthy()
      }
      expect(g.places.length).toBeGreaterThan(0)
      for (const p of g.places) {
        expect(buildingById(p.building), p.building).toBeDefined()
        if (p.facility) expect(FACILITIES[p.building].some(f => f.name.ko === p.facility), `${p.building}/${p.facility}`).toBe(true)
      }
    }
  })
  it('화면용 묶음: 시설이면 시설 이름·건물·전화, 건물만이면 건물 이름', () => {
    const [visitor, resident] = audienceView('en')
    expect(visitor.title).toBe('Visitors & parents')
    const gate = visitor.places[0]
    expect(gate).toMatchObject({ building: 'mainguard', name: 'Main Gate Info Booth', tel: '' })
    const post = resident.places.find(p => p.building === 'union')
    expect(post).toMatchObject({ name: 'Post office (mail & parcels)', buildingName: 'Student Union', where: 'Floor 1', tel: '033-570-6753', open: 'Open to everyone' })
  })
  it('모르는 건물·시설은 조용히 뺀다', () => {
    const list = audienceView('ko')
    expect(list.every(g => g.places.every(p => buildingById(p.building)))).toBe(true)
  })
})

describe('시설의 외부인 이용 표시', () => {
  it('상점·식당·우편은 누구나, 도서관·운동 시설은 전화 문의, 사무실은 표시 없음', () => {
    const union = facilitiesFor('union', 'ko')
    expect(union.find(f => f.name === '서점')?.open).toBe('누구나 이용')
    expect(facilitiesFor('library', 'vi').find(f => f.name.startsWith('Quầy'))?.open).toBe('Người ngoài: gọi để hỏi')
    expect(facilitiesFor('greenenergy', 'ko').find(f => f.name === '학생증 발급')?.open).toBe('')
  })
})
