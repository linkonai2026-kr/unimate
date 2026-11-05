// 신청 메일 초안: 공지 본문의 메일 주소만 받는 사람으로, mailto 주소, 키 없이 쓰는 메일 틀, 서버 액션
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
const me = { id: 'mail-user', handle: 'mailuser', nickname: 'Linh', nationality: 'VN', lang: 'vi', passHash: '', createdAt: 0 }
vi.mock('@/lib/auth/session', () => ({ requireUser: async () => me }))
const BODY = '<div class="editor-wrap">신청서를 작성해 scholar@kangwon.ac.kr 로 보내 주세요. 문의: help@example.com.</div>'
vi.mock('@/lib/school/notices', async orig => ({ ...(await orig<typeof import('@/lib/school/notices')>()), getNoticeHtml: async () => BODY }))

import { draftMail } from '@/app/deadline-actions'
import { draftApplyMail, type MailInput } from '@/lib/ai'
import { fakeMail } from '@/lib/ai/fake'
import { mailtoHref, noticeEmails } from '@/lib/deadlines/links'
import { getTaskStore } from '@/lib/deadlines/store'

const input: MailInput = {
  notice: { title: '2026학년도 2학기 국가장학금 신청 안내', body: '신청서를 이메일로 제출', deadline: '11/20 18:00', apply: { how: 'email', where: '학생지원과', url: null, documents: ['신청서', '재학증명서'] } },
  student: { name: '응우옌 린', major: '전자공학과', studentId: '202412345' },
}

describe('noticeEmails', () => {
  it('본문에 적힌 주소만, 학교 주소를 먼저, 끝의 마침표는 떼고 한 번씩', () => {
    expect(noticeEmails('문의 help@example.com. 또는 scholar@kangwon.ac.kr, SCHOLAR@kangwon.ac.kr')).toEqual(['scholar@kangwon.ac.kr', 'help@example.com'])
    expect(noticeEmails('메일 주소 없음')).toEqual([])
  })
})

describe('mailtoHref', () => {
  it('제목·본문을 채우고 줄바꿈은 CRLF로', () => {
    const href = mailtoHref('scholar@kangwon.ac.kr', '[신청] 장학금', '안녕하세요.\n감사합니다.')
    expect(href.startsWith('mailto:scholar@kangwon.ac.kr?subject=')).toBe(true)
    expect(decodeURIComponent(href.split('body=')[1])).toBe('안녕하세요.\r\n감사합니다.')
    expect(href).not.toContain('+')
  })
  it('주소가 이상하면 받는 사람을 비운다(다른 머리글을 끼워 넣지 못하게)', () => {
    expect(mailtoHref('a@b.c?bcc=x@y.z', 's', 'b').startsWith('mailto:?subject=')).toBe(true)
    expect(mailtoHref('', 's', 'b').startsWith('mailto:?subject=')).toBe(true)
  })
})

describe('fakeMail(키 없을 때의 틀)', () => {
  it('정중한 한국어 메일: 자기소개, 공지 제목, 마감, 준비물, 서명', () => {
    const d = fakeMail(input, 'vi')
    expect(d.subject).toBe('[신청] 2026학년도 2학기 국가장학금 신청 안내 - 응우옌 린')
    expect(d.body).toContain('안녕하세요. 전자공학과 202412345 응우옌 린입니다.')
    expect(d.body).toContain('11/20 18:00')
    expect(d.body).toContain('첨부한 서류: 신청서, 재학증명서')
    expect(d.body.trim().endsWith('응우옌 린 드림')).toBe(true)
  })
  it('학생 언어 번역을 함께 주고, 한국어 사용자는 같은 글', () => {
    expect(fakeMail(input, 'vi').bodyTr).toContain('Em là')
    expect(fakeMail(input, 'zh').subjectTr.startsWith('[申请]')).toBe(true)
    expect(fakeMail(input, 'uz').bodyTr).toContain('Rahmat.')
    const ko = fakeMail(input, 'ko')
    expect(ko.bodyTr).toBe(ko.body)
  })
  it('이메일 제출이 아니면 문의 메일, 비어 있는 정보는 빼고 공지에 없는 내용은 넣지 않는다', () => {
    const d = fakeMail({ ...input, notice: { ...input.notice, deadline: null, apply: { how: 'visit', where: null, url: null, documents: [] } }, student: { name: '', major: '', studentId: '' } }, 'en')
    expect(d.subject.startsWith('[문의]')).toBe(true)
    expect(d.body).not.toContain('마감')
    expect(d.body).not.toContain('서류')
    expect(d.body.startsWith('안녕하세요.\n')).toBe(true)
  })
  it('AI 키가 없으면 draftApplyMail이 틀을 돌려준다', async () => {
    expect(await draftApplyMail(input, 'en')).toEqual(fakeMail(input, 'en'))
  })
})

describe('draftMail 서버 액션', () => {
  let taskId = ''
  beforeEach(async () => {
    const t = await getTaskStore().save({
      userId: me.id, board: 'academic', noticeId: 'mail-1', title: 'Học bổng', titleKo: '국가장학금 신청 안내',
      deadline: '11/20 18:00', dueAt: null, url: 'https://www.kangwon.ac.kr/x', apply: input.notice.apply,
    })
    taskId = t.id
  })
  const form = (to: string) => {
    const f = new FormData()
    f.set('name', ' 응우옌 린 '); f.set('major', '전자공학과'); f.set('studentId', '202412345'); f.set('to', to)
    return f
  }

  it('초안과 mailto를 만들고, 받는 사람은 본문에 적힌 주소만 쓴다', async () => {
    const s = await draftMail(taskId, undefined, form('help@example.com'))
    if (!s?.ok) throw new Error('draft failed')
    expect(s.to).toBe('help@example.com')
    expect(s.draft.body).toContain('응우옌 린')
    expect(s.mailto.startsWith('mailto:help@example.com?subject=')).toBe(true)
    expect(s.draft.bodyTr).toContain('Em là')
  })
  it('본문에 없는 주소를 보내면 본문의 학교 주소로 바꾼다', async () => {
    const s = await draftMail(taskId, undefined, form('attacker@evil.test'))
    if (!s?.ok) throw new Error('draft failed')
    expect(s.to).toBe('scholar@kangwon.ac.kr')
  })
  it('남의 할 일·없는 할 일이면 missing', async () => {
    expect(await draftMail('no-such-task', undefined, form(''))).toMatchObject({ ok: false, error: 'missing' })
    expect(await draftMail('../x', undefined, form(''))).toMatchObject({ ok: false, error: 'missing' })
  })
})
