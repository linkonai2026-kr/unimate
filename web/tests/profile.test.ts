// 프로필 수정 입력 정리와 비밀번호 변경 규칙 테스트
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { cleanProfilePatch, checkPasswordChange, isDemoAccount } from '@/lib/profile'
import { nationLabel, nationName } from '@/lib/nations'
import { createMemoryStore } from '@/lib/store/memory'

describe('cleanProfilePatch', () => {
  it('허용 값만 남기고 길이를 자른다', () => {
    expect(cleanProfilePatch({ nickname: '  새닉네임  ', avatar: '3', major: '전자공학과', year: '24학번', lang: 'vi', nationality: 'VN' }))
      .toEqual({ nickname: '새닉네임', avatar: 3, major: '전자공학과', year: '24학번', lang: 'vi', nationality: 'VN' })
  })
  it('잘못된 값은 버린다', () => {
    expect(cleanProfilePatch({ nickname: '', avatar: '99', lang: 'fr', nationality: 'ZZZ', major: 'x'.repeat(50) }))
      .toEqual({ major: 'x'.repeat(30) })
  })
})

describe('cleanProfilePatch 세부', () => {
  it('학과·학번을 비워 보내면 지운다', () => {
    expect(cleanProfilePatch({ nickname: 'A', major: '  ', year: '' })).toEqual({ nickname: 'A', major: '', year: '' })
  })
  it('줄바꿈·제어 문자는 공백으로 바꾸고 공백을 하나로', () => {
    expect(cleanProfilePatch({ nickname: '민\n\t준', major: '전자\u0000공학과' })).toEqual({ nickname: '민 준', major: '전자 공학과' })
  })
  it('이모지는 반쪽으로 자르지 않는다', () => {
    const major = cleanProfilePatch({ major: `${'가'.repeat(29)}😀😀` }).major!
    expect(major).toBe(`${'가'.repeat(29)}😀`)
  })
  it('그림 번호는 0~7 정수만', () => {
    expect(cleanProfilePatch({ avatar: '7' })).toEqual({ avatar: 7 })
    for (const avatar of ['-1', '8', '1.5', ' ', 'x']) expect(cleanProfilePatch({ avatar })).toEqual({})
  })
  it('국적은 목록 코드만, 프로토타입 이름은 언어로 안 받는다', () => {
    expect(cleanProfilePatch({ nationality: 'XX', lang: 'toString' })).toEqual({ nationality: 'XX' })
  })
})

describe('nationName', () => {
  it('서버·브라우저가 같은 글자를 내도록 표에서 고른다', () => {
    expect(nationName('KR', 'ko')).toBe('대한민국')
    expect(nationName('VN', 'vi')).toBe('Việt Nam')
    expect(nationName('XX', 'uz')).toBe('Boshqa')
    expect(nationName('KR', 'fr')).toBe('South Korea')
  })
})

describe('checkPasswordChange', () => {
  const hash = hashPassword('oldpass123')
  it('현재 비밀번호가 맞고 새 비밀번호가 8자 이상이면 통과', () => expect(checkPasswordChange('oldpass123', 'newpass456', hash)).toBe('ok'))
  it('현재 비밀번호가 틀리면 wrong', () => expect(checkPasswordChange('nope', 'newpass456', hash)).toBe('wrong'))
  it('새 비밀번호가 짧으면 short', () => expect(checkPasswordChange('oldpass123', 'short', hash)).toBe('short'))
  it('새 비밀번호가 128자를 넘어도 short', () => expect(checkPasswordChange('oldpass123', 'x'.repeat(129), hash)).toBe('short'))
})

describe('store profile patch', () => {
  it('프로필 그림·학과·비밀번호를 바꾼다', async () => {
    const s = createMemoryStore(false)
    const p = await s.createProfile({ handle: 'a1', nickname: 'A', nationality: 'KR', lang: 'ko', passHash: hashPassword('x1234567') })
    await s.updateProfile(p.id, { avatar: 2, major: '컴퓨터공학과', passHash: hashPassword('y1234567') })
    const got = (await s.getProfile(p.id))!
    expect(got.avatar).toBe(2)
    expect(got.major).toBe('컴퓨터공학과')
    expect(verifyPassword('y1234567', got.passHash)).toBe(true)
  })
})

describe('isDemoAccount', () => {
  it('시드 데모 계정(u-)만 데모로 본다', () => {
    expect(isDemoAccount({ id: 'u-wei' })).toBe(true)
    expect(isDemoAccount({ id: 'a1b2c3' })).toBe(false)
  })
})

describe('nationLabel', () => {
  it('국적 칸 글자는 국기 이모지와 이름, 기타는 지구본', () => {
    expect(nationLabel('VN', 'vi')).toBe('🇻🇳 Việt Nam')
    expect(nationLabel('KR', 'ko')).toBe('🇰🇷 대한민국')
    expect(nationLabel('XX', 'en')).toBe('🌐 Other')
  })
})
