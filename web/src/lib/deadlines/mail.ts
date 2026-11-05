// 신청 메일 초안의 서버 쪽 재료: 공지 본문(학교 사이트에서 받아 10분 공유)과, 본문에 적힌 메일 주소
import 'server-only'
import type { MailInput } from '../ai'
import { createMemo } from '../school/memo'
import { getNoticeHtml, parseNoticeBody, type NoticeBoard } from '../school/notices'
import { noticeEmails } from './links'
import type { DeadlineTask } from './store'

const g = globalThis as { __uniNoticeBodyMemo?: ReturnType<typeof createMemo> }
const memo = (g.__uniNoticeBodyMemo ??= createMemo(10 * 60_000))

/** 공지 본문 글자. 사이트가 안 되면 빈 문자열(캐시하지 않는다) */
export function noticeBody(board: NoticeBoard, id: string): Promise<string> {
  return memo(`${board}:${id}`, async () => parseNoticeBody(await getNoticeHtml(board, id)), v => v.length > 0)
}

/** 받는 사람 후보: 공지 본문에 실제로 적힌 주소만 */
export async function officeEmails(task: Pick<DeadlineTask, 'board' | 'noticeId'>): Promise<string[]> {
  return noticeEmails(await noticeBody(task.board, task.noticeId))
}

/** AI에 넘길 재료. 본문을 못 받으면 제목·마감·신청 방법만으로 쓴다 */
export async function mailInput(task: DeadlineTask, student: MailInput['student']): Promise<MailInput> {
  const body = await noticeBody(task.board, task.noticeId)
  return { notice: { title: task.titleKo || task.title, body, deadline: task.deadline, apply: task.apply }, student }
}
