// 가입 화면의 국적 목록과 국기·국가 이름 표시(서버·브라우저가 같은 글자를 내도록 이름은 표로 둔다)
export const NATIONS = ['KR', 'VN', 'CN', 'UZ', 'MN', 'JP', 'US', 'XX'] as const
export type Nation = (typeof NATIONS)[number]

export const isNation = (v: unknown): v is Nation => typeof v === 'string' && (NATIONS as readonly string[]).includes(v)

/** 두 글자 국가 코드를 국기 이모지로. 모르는 코드는 지구본 */
export function flag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code) || code === 'XX') return '🌐'
  return String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
}

// Intl.DisplayNames는 Node와 브라우저의 ICU 버전마다 글자가 달라 하이드레이션이 어긋날 수 있다 → 고정 표
const NAMES: Record<Nation, Record<'ko' | 'en' | 'vi' | 'zh' | 'uz', string>> = {
  KR: { ko: '대한민국', en: 'South Korea', vi: 'Hàn Quốc', zh: '韩国', uz: 'Janubiy Koreya' },
  VN: { ko: '베트남', en: 'Vietnam', vi: 'Việt Nam', zh: '越南', uz: 'Vyetnam' },
  CN: { ko: '중국', en: 'China', vi: 'Trung Quốc', zh: '中国', uz: 'Xitoy' },
  UZ: { ko: '우즈베키스탄', en: 'Uzbekistan', vi: 'Uzbekistan', zh: '乌兹别克斯坦', uz: 'Oʻzbekiston' },
  MN: { ko: '몽골', en: 'Mongolia', vi: 'Mông Cổ', zh: '蒙古', uz: 'Mongoliya' },
  JP: { ko: '일본', en: 'Japan', vi: 'Nhật Bản', zh: '日本', uz: 'Yaponiya' },
  US: { ko: '미국', en: 'United States', vi: 'Hoa Kỳ', zh: '美国', uz: 'Amerika Qo‘shma Shtatlari' },
  XX: { ko: '기타', en: 'Other', vi: 'Khác', zh: '其他', uz: 'Boshqa' },
}

/** 국가 코드를 사용자 언어 이름으로. 표에 없는 코드는 내장 Intl, 그것도 안 되면 코드 그대로 */
export function nationName(code: string, lang: string): string {
  if (isNation(code)) return NAMES[code][lang as keyof (typeof NAMES)[Nation]] ?? NAMES[code].en
  try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code } catch { return code }
}
