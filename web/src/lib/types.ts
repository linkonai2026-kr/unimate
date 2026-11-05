// 앱 전체가 공유하는 도메인 타입
import type { Lang } from './i18n'
export type { Lang }

/** 언어별 {필드명: 번역문} */
export type TrMap = Partial<Record<Lang, Record<string, string>>>

/** 시간표 요일(월=0 … 금=4) */
export type Weekday = 0 | 1 | 2 | 3 | 4

export interface Profile {
  id: string
  handle: string
  nickname: string
  /** ISO 3166 두 글자 국가 코드 */
  nationality: string
  lang: Lang
  passHash: string
  createdAt: number
  /** 프로필 그림 번호(0~7), 없으면 기본 그림 */
  avatar?: number
  /** 학과·학번(선택, 빈 문자열이면 지운 것) */
  major?: string
  year?: string
  /** 올린 프로필 사진 id(없으면 기본 그림) */
  photo?: string | null
  /** 고정한 게시판 id(없으면 기본 고정 목록) */
  pins?: string[]
  /** 확인된 규칙 위반 횟수(1·2번은 경고, 3번째부터 이용 제한) */
  violations?: number
  /** 이 시각(ms)까지 글·댓글·쪽지 금지 */
  suspendedUntil?: number | null
  /** 마지막 이용 제한의 규칙 id */
  sanctionReason?: string | null
}

export interface Post {
  id: string
  board: string
  authorId: string
  anonymous: boolean
  title: string
  body: string
  /** 원문 언어(번역 시 감지값으로 갱신) */
  lang: Lang
  tr: TrMap
  likes: string[]
  scraps: string[]
  /** 첨부 사진 id(최대 4장) */
  images: string[]
  createdAt: number
  /** 규칙 위반으로 가려짐(목록·검색에서 빠지고 상세는 안내 문구만) */
  hidden?: boolean
}

export interface Comment {
  id: string
  postId: string
  parentId: string | null
  authorId: string
  anonymous: boolean
  body: string
  lang: Lang
  tr: TrMap
  likes: string[]
  createdAt: number
  /** 규칙 위반으로 가려짐 */
  hidden?: boolean
}

/** 글·댓글 신고. 한 사람이 같은 글·댓글은 한 번만 */
export interface Report {
  id: string
  reporterId: string
  kind: 'post' | 'comment'
  targetId: string
  /** 신고된 글·댓글 작성자 */
  authorId: string
  reason: string
  detail: string
  /** AI 검수 결과. 검수 전·실패면 pending */
  status: 'pending' | 'violation' | 'clean'
  createdAt: number
}

export interface Table {
  id: string
  userId: string
  /** 예: "2026년 2학기" */
  sem: string
  name: string
  /** 친구에게 보이는 기본 시간표 */
  primary: boolean
  /** 과목 키 → 색 번호 */
  colors: Record<string, number>
  createdAt: number
}

export interface Course {
  id: string
  userId: string
  tableId: string
  /** 강좌 목록에서 담은 과목이면 코드 */
  code?: string
  credit?: number
  prof?: string
  name: string
  place: string
  day: Weekday
  /** 자정부터 분. 540 = 09:00 */
  start: number
  end: number
}

export interface Review {
  id: string
  courseName: string
  professor: string
  authorId: string
  rating: number
  fields: Record<string, string>
  body: string
  lang: Lang
  tr: TrMap
  createdAt: number
}

export interface Message {
  id: string
  fromId: string
  toId: string
  body: string
  lang: Lang
  tr: TrMap
  createdAt: number
}

export interface LiveEvent {
  topic: string
  kind: 'new' | 'tr' | 'like' | 'del'
  id: string
}

/** 사용자가 만든 게시판(이름·설명은 만든 사람 언어, 나머지 언어는 tr) */
export interface Board {
  id: string
  name: string
  desc: string
  lang: Lang
  tr: TrMap
  ownerId: string
  createdAt: number
}
